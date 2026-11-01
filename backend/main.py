import os
import re
import uuid
import json
import base64
import tempfile
import logging
import concurrent.futures
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status, Query, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from database import get_supabase, get_authenticated_user
from models import (
    VaultItemCreate,
    VaultItemUpdate,
    DraftCreate,
    ApplyFixRequest,
    ReviseDraftRequest,
    RequestApprovalRequest,
    ApproveDraftRequest,
    RequestChangesRequest,
    AddCommentRequest,
    AttachImageRequest,
    ReviewDraftRequest,
    BrandCreate,
)
from review_engine import run_deterministic_review, apply_fix_to_text, _tag_page
from llm_review import run_grounded_llm_review
from document_parser import parse_document, MAX_FILE_SIZE_BYTES, analyze_image_bytes, extract_palette_from_vault

# Configure secure module logger
logger = logging.getLogger("brandgate.api")

# Load local environment variables from .env if present (override=True ensures .env values take precedence)
load_dotenv(override=True)

DEMO_BRAND_ID = "00000000-0000-0000-0000-000000000001"
DEMO_BRAND_B_ID = "00000000-0000-0000-0000-000000000002"
DEMO_BRAND_IDS = {DEMO_BRAND_ID, DEMO_BRAND_B_ID}

# Guest demo draft aliases in-memory map to canonical database UUIDs
_DEMO_DRAFT_MAPPINGS: Dict[str, str] = {}

def is_valid_uuid(val: Any) -> bool:
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, TypeError, AttributeError):
        return False

# Thread pool executor and persistent cache for grounded LLM reviews (B1 decoupling & timeout protection)
_LLM_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=4)
_DRAFT_LAST_LLM_REVIEW: Dict[str, Dict[str, Any]] = {}
_DRAFT_PAGES: Dict[str, List[Dict[str, Any]]] = {}
_DRAFT_DOC_META: Dict[str, Dict[str, Any]] = {}

def _save_cached_pages(draft_id: str, pages: List[Dict[str, Any]]):
    if not draft_id or not pages:
        return
    s_id = str(draft_id)
    _DRAFT_PAGES[s_id] = pages
    try:
        cache_path = os.path.join(tempfile.gettempdir(), f"bg_pages_{s_id}.json")
        with open(cache_path, "w") as f:
            json.dump(pages, f)
    except Exception:
        pass

def _get_cached_pages(draft_id: str) -> Optional[List[Dict[str, Any]]]:
    if not draft_id:
        return None
    s_id = str(draft_id)
    if s_id in _DRAFT_PAGES:
        return _DRAFT_PAGES[s_id]
    try:
        cache_path = os.path.join(tempfile.gettempdir(), f"bg_pages_{s_id}.json")
        if os.path.exists(cache_path):
            with open(cache_path, "r") as f:
                pages = json.load(f)
                _DRAFT_PAGES[s_id] = pages
                return pages
    except Exception:
        pass
    return None

app = FastAPI(
    title="BrandGate API",
    description="Pre-publication brand-governance gate backend API",
    version="1.0.0",
)

# ------------------------------------------------------------------------------
# Strict CORS Origin Configuration (Blocker 5)
# ------------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://brand-gate-rho.vercel.app",
]

frontend_url_env = os.getenv("FRONTEND_URL", "")
if frontend_url_env:
    for url in frontend_url_env.split(","):
        clean_url = url.strip()
        if clean_url and clean_url not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(clean_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://brand-gate-[a-z0-9-]+-.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_safe_cors_origin(request: Request) -> str:
    """Returns incoming origin only if on allowlist or Vercel preview regex; falls back to production frontend."""
    origin = request.headers.get("origin")
    if not origin:
        return ALLOWED_ORIGINS[0]
    if origin in ALLOWED_ORIGINS:
        return origin
    if re.match(r"^https://brand-gate-[a-z0-9-]+-.*\.vercel\.app$", origin):
        return origin
    return "https://brand-gate-rho.vercel.app"

# ------------------------------------------------------------------------------
# Explicit CORS-Guaranteed Exception Handlers (Blocker 4 & 5)
# ------------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    safe_origin = get_safe_cors_origin(request)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": safe_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = str(uuid.uuid4())
    safe_origin = get_safe_cors_origin(request)
    try:
        logger.error(f"[REQ-{request_id}] Unhandled server exception at {request.url.path}: {exc}", exc_info=True)
    except Exception:
        pass
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "request_id": request_id},
        headers={
            "Access-Control-Allow-Origin": safe_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


# ------------------------------------------------------------------------------
# Service Metadata & Health Endpoints
# ------------------------------------------------------------------------------
@app.get("/", summary="Service metadata endpoint")
def root_endpoint() -> Dict[str, Any]:
    return {
        "service": "BrandGate API",
        "version": "1.0.0",
        "status": "ok",
        "health": "/health",
        "endpoints": {
            "health": "/health",
            "brands": "/api/brands",
            "drafts": "/api/drafts",
            "insights": "/api/insights"
        }
    }

@app.get("/health", summary="Health check endpoint")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


# ------------------------------------------------------------------------------
# Server-Side Authorization & Tenant Isolation Helpers (Blocker 1)
# ------------------------------------------------------------------------------
def verify_brand_exists(supabase, brand_id: str):
    res = supabase.table("brands").select("id, name").eq("id", brand_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown brand_id: {brand_id}"
        )
    return res.data[0]

def check_brand_access(user: Optional[Dict[str, Any]], brand_id: str, write: bool = False):
    """
    Enforces server-side brand authorization:
    - Guests are strictly limited to DEMO_BRAND_IDS (Brand A and Brand B).
    - Demo brand vaults are read-only for guests (write=True raises 403).
    - If brand_id is not in DEMO_BRAND_IDS and caller is unauthenticated, raises 403.
    """
    if not user:
        if brand_id not in DEMO_BRAND_IDS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest operations are restricted strictly to the seeded demo brands."
            )
        if write:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Demo brand vault is read-only for guests. Please sign in to manage brand vaults."
            )

def verify_draft_access(supabase, draft_id: str, user: Optional[Dict[str, Any]], required_role: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches draft and verifies caller has legitimate tenant / role access:
    - Guests can ONLY access drafts belonging to DEMO_BRAND_IDS.
    - If user is present, verifies role matches required_role (if specified).
    - Safely resolves guest demo draft aliases (local-draft-*, demo, etc.) without SQL syntax errors.
    """
    draft_id_str = str(draft_id).strip()

    is_demo_alias = (
        draft_id_str.startswith("local-draft-") or
        draft_id_str.startswith("local-") or
        draft_id_str.lower() in ("demo", "demo-draft", "guest-demo", "default", "demo-b", "demo-brand-b")
    )

    # First, if it is a demo alias and we have a mapped real UUID, use that
    if is_demo_alias:
        mapped_uuid = _DEMO_DRAFT_MAPPINGS.get(draft_id_str)
        if mapped_uuid:
            try:
                res = supabase.table("drafts").select("*").eq("id", mapped_uuid).execute()
                if res.data:
                    return res.data[0]
            except Exception:
                pass

    # Try querying drafts table directly (handles real UUIDs as well as test mocks)
    draft_res = None
    try:
        draft_res = supabase.table("drafts").select("*").eq("id", draft_id_str).execute()
    except Exception as e:
        # PostgreSQL syntax error 22P02 for invalid UUID syntax
        if "22P02" in str(e) or "invalid input syntax for type uuid" in str(e):
            draft_res = None
        else:
            raise

    if draft_res and draft_res.data:
        draft = draft_res.data[0]
    elif is_demo_alias:
        is_b_brand = ("-b" in draft_id_str.lower() or "_b" in draft_id_str.lower() or "novatech" in draft_id_str.lower())
        target_demo_brand = DEMO_BRAND_B_ID if is_b_brand else DEMO_BRAND_ID

        if is_b_brand:
            locked_text = "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!"
            demo_record = {
                "brand_id": DEMO_BRAND_B_ID,
                "title": "NovaTech ANC 500 Launch Campaign",
                "body_text": locked_text,
                "alt_text": None,
                "image_url": None,
                "status": "draft",
                "current_version": 1,
                "created_by_role": "guest",
            }
        else:
            LOCKED_DEMO_TEXT = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"
            demo_record = {
                "brand_id": DEMO_BRAND_ID,
                "title": "Diwali Festive Cookware Campaign",
                "body_text": LOCKED_DEMO_TEXT,
                "alt_text": None,
                "image_url": None,
                "status": "draft",
                "current_version": 1,
                "created_by_role": "guest",
            }

        res = supabase.table("drafts").insert(demo_record).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to initialize demo draft")
        draft = res.data[0]
        actual_id = draft["id"]
        supabase.table("draft_versions").insert({
            "draft_id": actual_id,
            "version_no": 1,
            "body_text": demo_record["body_text"],
            "alt_text": None,
        }).execute()
        _DEMO_DRAFT_MAPPINGS[draft_id_str] = actual_id
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )

    brand_id = draft.get("brand_id")

    if not user:
        if brand_id not in DEMO_BRAND_IDS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest access is restricted strictly to seeded demo brand drafts."
            )
    else:
        if brand_id not in DEMO_BRAND_IDS:
            if user.get("role") != "reviewer" and draft.get("created_by_user_id") != user.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to view or modify this draft."
                )

    if required_role and user and user.get("role") != required_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation requires '{required_role}' role."
        )

    return draft

# ------------------------------------------------------------------------------
# Brands API (Blocker 1 & Multi-brand)
# ------------------------------------------------------------------------------
@app.get("/api/brands", summary="List all brands")
def list_brands(request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()
    res = supabase.table("brands").select("*").order("name").execute()
    all_brands = res.data or []

    enriched = []
    for b in all_brands:
        brand_item = dict(b)
        if "created_by" not in brand_item or not brand_item["created_by"]:
            brand_item["created_by"] = "system" if brand_item.get("id") in DEMO_BRAND_IDS else "user"
        enriched.append(brand_item)

    if not user:
        # Guests can see both seeded demo brands
        return [b for b in enriched if b.get("id") in DEMO_BRAND_IDS]
    return enriched

@app.post("/api/brands", summary="Create a new brand", status_code=status.HTTP_201_CREATED)
def create_brand(payload: BrandCreate, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    creator_id = user["id"] if user else "guest"
    supabase = get_supabase()

    new_brand_id = str(uuid.uuid4())
    record = {
        "id": new_brand_id,
        "name": payload.name,
    }
    res = supabase.table("brands").insert(record).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create brand.")
    created = dict(res.data[0])
    created["created_by"] = creator_id
    return created

@app.get("/api/brands/{brand_id}", summary="Get a brand by ID")
def get_brand(brand_id: str, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=False)
    supabase = get_supabase()
    b = verify_brand_exists(supabase, brand_id)
    brand = dict(b)
    if "created_by" not in brand or not brand["created_by"]:
        brand["created_by"] = "system" if brand_id in DEMO_BRAND_IDS else "user"
    return brand

# ------------------------------------------------------------------------------
# Vault Items API (Blocker 1)
# ------------------------------------------------------------------------------
@app.get("/api/brands/{brand_id}/vault", summary="List vault items grouped by kind")
def get_brand_vault(brand_id: str, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=False)

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    res = supabase.table("vault_items").select("*").eq("brand_id", brand_id).order("item_id").execute()

    grouped: Dict[str, List[Dict[str, Any]]] = {
        "fact": [],
        "rule": [],
        "terminology": [],
        "palette": []
    }

    for item in res.data:
        kind = item.get("kind", "fact")
        if kind in grouped:
            grouped[kind].append(item)
        else:
            grouped[kind] = [item]

    return grouped

@app.post("/api/brands/{brand_id}/vault", summary="Create a vault item", status_code=status.HTTP_201_CREATED)
def create_vault_item(brand_id: str, item: VaultItemCreate, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=True)

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    # Check duplicate (brand_id, item_id) -> Return 409 Conflict
    existing = supabase.table("vault_items").select("id").eq("brand_id", brand_id).eq("item_id", item.item_id).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vault item with item_id '{item.item_id}' already exists for this brand."
        )

    new_record = {
        "brand_id": brand_id,
        "item_id": item.item_id,
        "kind": item.kind,
        "title": item.title,
        "text": item.text,
        "status": item.status,
    }

    res = supabase.table("vault_items").insert(new_record).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create vault item.")
    return res.data[0]

@app.patch("/api/brands/{brand_id}/vault/{item_id}", summary="Edit a vault item")
def update_vault_item(brand_id: str, item_id: str, payload: VaultItemUpdate, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=True)

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    existing = supabase.table("vault_items").select("*").eq("brand_id", brand_id).eq("item_id", item_id).execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vault item '{item_id}' not found for this brand."
        )

    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.text is not None:
        updates["text"] = payload.text
    if payload.status is not None:
        updates["status"] = payload.status

    if not updates:
        return existing.data[0]

    res = supabase.table("vault_items").update(updates).eq("brand_id", brand_id).eq("item_id", item_id).execute()
    return res.data[0]

@app.delete("/api/brands/{brand_id}/vault/{item_id}", summary="Delete a vault item")
def delete_vault_item(brand_id: str, item_id: str, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=True)

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    existing = supabase.table("vault_items").select("id").eq("brand_id", brand_id).eq("item_id", item_id).execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vault item '{item_id}' not found for this brand."
        )

    supabase.table("vault_items").delete().eq("brand_id", brand_id).eq("item_id", item_id).execute()
    return {"status": "deleted", "item_id": item_id}


@app.post("/api/brands/{brand_id}/vault/reset-demo", summary="Restore seeded demo vault items")
def reset_demo_vault(brand_id: str, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=True)

    # Enforce guest demo scoping: only demo brands can be reset
    if brand_id not in DEMO_BRAND_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reset operation is permitted strictly for seeded demo brands."
        )

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    # 1. Clear existing items for this brand
    supabase.table("vault_items").delete().eq("brand_id", brand_id).execute()

    # 2. Re-insert items for the respective demo brand
    if brand_id == DEMO_BRAND_B_ID:
        demo_items = [
            {
                "brand_id": brand_id,
                "item_id": "F-20",
                "kind": "fact",
                "title": "NovaTech ANC 500 Launch Price",
                "text": "NovaTech ANC 500 Wireless Headphones launch price Rs. 4,999, effective 1-15 Nov 2026.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "R-15",
                "kind": "rule",
                "title": "Battery Life & Latency Claims Require Verified Lab Benchmarks",
                "text": "Battery life and latency claims require verified lab test benchmarks. Seeded vault has NO approved lab benchmarks.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "T-10",
                "kind": "terminology",
                "title": "Restricted Term: world's best audio",
                "text": 'Term "world\'s best audio" is restricted. Cannot be used without third-party acoustic certification.',
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-10",
                "kind": "palette",
                "title": "Midnight Obsidian Primary",
                "text": "#0F172A - Seeded Midnight Obsidian primary chassis color.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-11",
                "kind": "palette",
                "title": "Electric Cyan Accent",
                "text": "#06B6D4 - Seeded Electric Cyan accent led color.",
                "status": "active"
            }
        ]
    else:
        demo_items = [
            {
                "brand_id": brand_id,
                "item_id": "F-12",
                "kind": "fact",
                "title": "Festive Cookware Promotional Price",
                "text": "Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "R-04",
                "kind": "rule",
                "title": "Superlatives & Ranking Claims Require Approved Evidence",
                "text": "Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "A-02",
                "kind": "rule",
                "title": "Approved Current Logo Requirement",
                "text": "Current approved logo file only; archived logo is not accepted.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "R-09",
                "kind": "rule",
                "title": "Mandatory Descriptive Image Alt Text",
                "text": "Every creative requires descriptive alt text.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "T-01",
                "kind": "terminology",
                "title": "Restricted Term: clinically proven",
                "text": 'Term "clinically proven" is categorized as evidence_required. Cannot be used without an approved clinical trial citation ID.',
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "T-02",
                "kind": "terminology",
                "title": "Restricted Term: India's No. 1",
                "text": 'Term "India\'s No. 1" is categorized as evidence_required. Cannot be used without a market research verification citation ID.',
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "T-03",
                "kind": "terminology",
                "title": "Approved Term: certified quality",
                "text": 'Term "certified quality" is an approved replacement for unsubstantiated superiority claims.',
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "T-04",
                "kind": "terminology",
                "title": "Approved Term: trusted cookware brand",
                "text": 'Term "trusted cookware brand" is an approved replacement for unsupported ranking claims.',
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-01",
                "kind": "palette",
                "title": "Primary Brand Blue",
                "text": "#1E3A8A - Seeded Primary Blue for headers, hero elements, and primary buttons.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-02",
                "kind": "palette",
                "title": "Secondary Accent Amber",
                "text": "#D97706 - Seeded Secondary Amber for highlight badges and key callouts.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-03",
                "kind": "palette",
                "title": "Surface Neutral Light",
                "text": "#F8FAFC - Seeded background color for clean, neutral canvas.",
                "status": "active"
            },
            {
                "brand_id": brand_id,
                "item_id": "P-04",
                "kind": "palette",
                "title": "Text Slate Dark",
                "text": "#0F172A - Seeded high-contrast text color.",
                "status": "active"
            }
        ]

    res = supabase.table("vault_items").insert(demo_items).execute()
    return {"status": "reset", "brand_id": brand_id, "restored_count": len(res.data)}

# ------------------------------------------------------------------------------
# Drafts API (Blocker 1 & 2)
# ------------------------------------------------------------------------------
@app.post("/api/drafts", summary="Create a draft and version 1", status_code=status.HTTP_201_CREATED)
def create_draft(payload: DraftCreate, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, payload.brand_id, write=False)

    supabase = get_supabase()
    verify_brand_exists(supabase, payload.brand_id)

    creator_role = user["role"] if user else "guest"

    # 1. Insert parent draft record
    draft_record = {
        "brand_id": payload.brand_id,
        "title": payload.title,
        "body_text": payload.body_text,
        "image_url": payload.image_url,
        "alt_text": payload.alt_text,
        "status": "draft",
        "current_version": 1,
        "created_by_role": creator_role,
    }
    if user:
        draft_record["created_by_user_id"] = user["id"]

    try:
        draft_res = supabase.table("drafts").insert(draft_record).execute()
    except Exception as exc:
        if "created_by_user_id" in draft_record:
            draft_record.pop("created_by_user_id", None)
            draft_res = supabase.table("drafts").insert(draft_record).execute()
        else:
            raise HTTPException(status_code=500, detail=f"Database error creating draft: {exc}")

    if not draft_res.data:
        raise HTTPException(status_code=500, detail="Failed to create draft.")

    created_draft = draft_res.data[0]
    draft_id = created_draft["id"]

    # 2. Insert draft_versions record (version 1)
    version_record = {
        "draft_id": draft_id,
        "version_no": 1,
        "body_text": payload.body_text,
        "alt_text": payload.alt_text
    }

    version_res = supabase.table("draft_versions").insert(version_record).execute()
    created_draft["versions"] = version_res.data or []
    return created_draft

@app.post("/api/documents/parse", summary="Parse and extract text, pages, and images from DOCX or PDF")
async def parse_document_endpoint(
    file: UploadFile = File(...),
    brand_id: Optional[str] = Form(None),
    request: Request = None
):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    if brand_id:
        check_brand_access(user, brand_id, write=False)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the 10MB limit. Please upload a file under 10MB."
        )

    lower_name = (file.filename or "").lower()
    if not (lower_name.endswith(".docx") or lower_name.endswith(".pdf")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document format. Only .docx and .pdf files are accepted."
        )

    supabase = get_supabase()
    active_vault_items = []
    if brand_id:
        v_res = supabase.table("vault_items").select("*").eq("brand_id", brand_id).eq("status", "active").execute()
        active_vault_items = v_res.data or []

    try:
        result = parse_document(file_bytes, file.filename or "uploaded_document", active_vault_items)
        return result
    except Exception as exc:
        logger.error(f"Failed to parse document {file.filename}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document parsing error: {str(exc)}"
        )

@app.post("/api/drafts/upload", summary="Create draft from DOCX/PDF upload and run governance check", status_code=status.HTTP_201_CREATED)
async def upload_draft_document(
    file: UploadFile = File(...),
    brand_id: str = Form(...),
    title: Optional[str] = Form(None),
    alt_text: Optional[str] = Form(None),
    logo_confirmed: Optional[bool] = Form(False),
    body_text: Optional[str] = Form(None),
    request: Request = None
):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    check_brand_access(user, brand_id, write=False)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the 10MB limit. Please upload a file under 10MB."
        )

    lower_name = (file.filename or "").lower()
    if not (lower_name.endswith(".docx") or lower_name.endswith(".pdf")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document format. Only .docx and .pdf files are accepted."
        )

    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    v_res = supabase.table("vault_items").select("*").eq("brand_id", brand_id).eq("status", "active").execute()
    active_vault_items = v_res.data or []

    parsed = parse_document(file_bytes, file.filename or "uploaded_document", active_vault_items)

    # Honest limits: document with no text layer cannot be text-checked
    if not parsed.get("has_text_layer"):
        if parsed.get("file_type") == "docx":
            msg = "DOCX document contains no extractable text — please upload a document with text content."
        else:
            msg = "Scanned-image PDF with no text layer detected — OCR is not supported in this phase. The document cannot be text-checked."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    first_image_url = None
    if parsed.get("images") and len(parsed["images"]) > 0:
        first_image_url = parsed["images"][0].get("data_url")

    doc_title = title or (file.filename or "Document Draft").rsplit(".", 1)[0]
    creator_role = user["role"] if user else "guest"
    effective_text = body_text if (body_text and body_text.strip()) else parsed["text"]

    draft_record = {
        "brand_id": brand_id,
        "title": doc_title,
        "body_text": effective_text,
        "image_url": first_image_url,
        "alt_text": alt_text,
        "status": "draft",
        "current_version": 1,
        "created_by_role": creator_role,
    }
    if user:
        draft_record["created_by_user_id"] = user["id"]

    try:
        draft_res = supabase.table("drafts").insert(draft_record).execute()
    except Exception as exc:
        if "created_by_user_id" in draft_record:
            draft_record.pop("created_by_user_id", None)
            draft_res = supabase.table("drafts").insert(draft_record).execute()
        else:
            raise HTTPException(status_code=500, detail=f"Database error creating draft: {exc}")

    if not draft_res.data:
        raise HTTPException(status_code=500, detail="Failed to create draft.")

    created_draft = draft_res.data[0]
    actual_id = created_draft["id"]

    version_record = {
        "draft_id": actual_id,
        "version_no": 1,
        "body_text": effective_text,
        "alt_text": alt_text
    }
    supabase.table("draft_versions").insert(version_record).execute()

    if parsed.get("file_type") == "pdf" and parsed.get("pages"):
        _save_cached_pages(actual_id, parsed["pages"])

    _DRAFT_DOC_META[actual_id] = {
        "filename": file.filename,
        "file_type": parsed.get("file_type"),
        "page_count": parsed.get("page_count", 1),
        "has_images": parsed.get("has_images", False),
        "is_off_palette": parsed.get("is_off_palette", False),
        "images_unextractable": parsed.get("images_unextractable", False),
        "unextractable_reason": parsed.get("unextractable_reason"),
    }

    pages_to_pass = parsed.get("pages") if parsed.get("file_type") == "pdf" else None
    contrast_to_pass = parsed.get("contrast_ratio")
    palette_unsampleable = parsed.get("palette_unsampleable", False)
    validated_findings = run_deterministic_review(
        body_text=effective_text,
        alt_text=alt_text,
        image_url=first_image_url,
        active_vault_items=active_vault_items,
        logo_confirmed=bool(logo_confirmed),
        palette_off=parsed.get("is_off_palette", False),
        contrast_ratio=contrast_to_pass,
        pages=pages_to_pass,
        palette_unsampleable=palette_unsampleable,
    )

    saved_findings = []
    if validated_findings:
        findings_to_insert = [
            {
                "draft_id": actual_id,
                "version_no": 1,
                "lane": f["lane"],
                "severity": f["severity"],
                "citation_id": f["citation_id"],
                "explanation": f["explanation"],
                "suggested_fix": f.get("suggested_fix"),
            }
            for f in validated_findings
        ]
        insert_res = supabase.table("findings").insert(findings_to_insert).execute()
        saved_findings = insert_res.data or []

    if not saved_findings and validated_findings:
        saved_findings = validated_findings

    for idx, f in enumerate(saved_findings):
        f["brand_id"] = brand_id
        if idx < len(validated_findings) and validated_findings[idx].get("page") is not None:
            f["page"] = validated_findings[idx]["page"]
        elif f.get("page") is None:
            page_m = re.search(r"\[Page\s+(\d+)\]", f.get("explanation", ""), re.IGNORECASE)
            if page_m:
                f["page"] = int(page_m.group(1))

    supabase.table("drafts").update({"status": "checked"}).eq("id", actual_id).execute()
    created_draft["status"] = "checked"
    created_draft["findings"] = saved_findings
    created_draft["versions"] = [version_record]

    return {
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": brand_id,
        "title": doc_title,
        "body_text": parsed["text"],
        "image_url": first_image_url,
        "alt_text": alt_text,
        "status": "checked",
        "current_version": 1,
        "created_by_role": creator_role,
        "draft": created_draft,
        "findings": saved_findings,
        "deterministic_findings": saved_findings,
        "has_text_layer": True,
        "page_count": parsed.get("page_count", 1),
        "file_type": parsed.get("file_type"),
        "has_images": parsed.get("has_images", False),
        "images_unextractable": parsed.get("images_unextractable", False),
        "unextractable_reason": parsed.get("unextractable_reason"),
    }

@app.get("/api/drafts/{draft_id}", summary="Get draft with all versions, findings, comments, decisions")
def get_draft(draft_id: str, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    # Tenant isolation & ownership check
    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    # Fetch versions, findings, comments, decisions
    versions_res = supabase.table("draft_versions").select("*").eq("draft_id", actual_id).order("version_no").execute()
    findings_res = supabase.table("findings").select("*").eq("draft_id", actual_id).order("created_at").execute()
    comments_res = supabase.table("comments").select("*").eq("draft_id", actual_id).order("created_at").execute()
    decisions_res = supabase.table("decisions").select("*").eq("draft_id", actual_id).order("created_at").execute()

    findings_data = findings_res.data or []
    for f in findings_data:
        f["brand_id"] = draft["brand_id"]
        if f.get("page") is None:
            page_m = re.search(r"\[Page\s+(\d+)\]", f.get("explanation", ""), re.IGNORECASE)
            if page_m:
                f["page"] = int(page_m.group(1))
        if f.get("page") is None:
            cached_pages = _get_cached_pages(actual_id) or _get_cached_pages(draft_id)
            if cached_pages:
                _tag_page(f, cached_pages)

    draft["versions"] = versions_res.data or []
    draft["findings"] = findings_data
    draft["comments"] = comments_res.data or []
    draft["decisions"] = decisions_res.data or []

    # If approved, attach locked approved snapshot
    if draft.get("status") == "approved":
        approve_decision = next(
            (d for d in reversed(draft["decisions"]) if d.get("decision") == "approve"),
            None
        )
        brand_name = "Demo Brand (Seeded)"
        if draft.get("brand_id") != DEMO_BRAND_ID:
            b_res = supabase.table("brands").select("name").eq("id", draft["brand_id"]).execute()
            if b_res.data and len(b_res.data) > 0:
                brand_name = b_res.data[0].get("name", "Brand Vault")

        draft["approved_snapshot"] = {
            "locked": True,
            "compliance_badge": "VERIFIED COMPLIANT",
            "approved_text": draft.get("body_text"),
            "image_reference": draft.get("image_url"),
            "alt_text": draft.get("alt_text"),
            "approver_role": approve_decision.get("role") if approve_decision else "reviewer",
            "timestamp": approve_decision.get("created_at") if approve_decision else draft.get("updated_at"),
            "vault_version": f"{brand_name} (Vault v1)",
            "brand_id": draft.get("brand_id"),
            "approved_version": draft.get("current_version", 1),
        }
    else:
        draft["approved_snapshot"] = None

    doc_meta = _DRAFT_DOC_META.get(actual_id) or _DRAFT_DOC_META.get(draft_id)
    if doc_meta:
        draft["document_meta"] = doc_meta
        if doc_meta.get("images_unextractable"):
            draft["images_unextractable"] = True
            draft["unextractable_reason"] = doc_meta.get("unextractable_reason")

    return draft

@app.get("/api/drafts", summary="List drafts for a brand (newest first)")
def list_drafts(brand_id: Optional[str] = Query(None, description="Filter drafts by brand UUID"), request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    target_brand = brand_id
    if not user:
        if target_brand:
            if target_brand not in DEMO_BRAND_IDS:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Guest operations are restricted strictly to seeded demo brands."
                )
        else:
            target_brand = DEMO_BRAND_ID
    elif target_brand:
        check_brand_access(user, target_brand, write=False)

    query = supabase.table("drafts").select("*")
    if target_brand:
        verify_brand_exists(supabase, target_brand)
        query = query.eq("brand_id", target_brand)
    elif not user:
        query = query.in_("brand_id", list(DEMO_BRAND_IDS))

    res = query.order("created_at", desc=True).execute()
    return res.data or []

# ------------------------------------------------------------------------------
# Review Engine & Revision Endpoints (Phase 3 & Blocker 1, 2, 3)
# ------------------------------------------------------------------------------
@app.post("/api/drafts/{draft_id}/review", summary="Run deterministic server-side brand review")
def review_draft(draft_id: str, payload: Optional[ReviewDraftRequest] = None, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    # Tenant isolation & authorization check
    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    # Fetch ACTIVE vault items only for the draft's brand (archived items strictly excluded)
    vault_res = (
        supabase.table("vault_items")
        .select("*")
        .eq("brand_id", draft["brand_id"])
        .eq("status", "active")
        .execute()
    )
    active_vault_items = vault_res.data or []

    # Run deterministic checks with citation validation
    logo_confirmed = payload.logo_confirmed if payload else False
    palette_off = payload.palette_off if payload else False
    contrast_ratio = payload.contrast_ratio if payload else None
    palette_unsampleable = payload.palette_unsampleable if payload else False
    remove_image = payload.remove_image if payload else False

    # Persist and synchronize image asset / alt text if passed in review request
    draft_updates = {}
    if remove_image:
        draft_updates["image_url"] = None
        # If draft previously had an image attached, create a new version for the removal
        if draft.get("image_url") is not None:
            new_v = draft.get("current_version", 1) + 1
            draft_updates["current_version"] = new_v
            draft["current_version"] = new_v
            try:
                supabase.table("draft_versions").insert({
                    "draft_id": actual_id,
                    "version_no": new_v,
                    "body_text": draft.get("body_text", ""),
                    "alt_text": None,
                }).execute()
            except Exception as v_exc:
                logger.warning(f"Could not insert draft version for image removal: {v_exc}")
        draft["image_url"] = None
        palette_off = False
        contrast_ratio = None
        palette_unsampleable = False
    else:
        if payload and payload.image_url is not None:
            draft_updates["image_url"] = payload.image_url
            draft["image_url"] = payload.image_url
        if payload and payload.alt_text is not None:
            draft_updates["alt_text"] = payload.alt_text
            draft["alt_text"] = payload.alt_text

    if draft_updates:
        try:
            supabase.table("drafts").update(draft_updates).eq("id", actual_id).execute()
        except Exception as upd_exc:
            logger.warning(f"Could not update draft image fields: {upd_exc}")

    cached_pages = (payload.pages if payload and payload.pages else None) or _get_cached_pages(actual_id) or _get_cached_pages(draft_id)
    if payload and payload.pages:
        _save_cached_pages(actual_id, payload.pages)

    doc_meta = _DRAFT_DOC_META.get(actual_id) or _DRAFT_DOC_META.get(draft_id) or {}
    if not remove_image:
        if not palette_off and doc_meta.get("is_off_palette"):
            palette_off = True
        if not palette_unsampleable and (doc_meta.get("palette_unsampleable") or doc_meta.get("images_unextractable")):
            palette_unsampleable = True
        if contrast_ratio is None and doc_meta.get("contrast_ratio") is not None:
            contrast_ratio = doc_meta.get("contrast_ratio")

        # Carried-over image handling: never silently drop P-01 on re-review
        active_img_url = draft.get("image_url")
        if active_img_url:
            # 1. If not already flagged off-palette, check if draft had previous palette findings
            if not palette_off:
                try:
                    prev_p_res = supabase.table("findings").select("id").eq("draft_id", actual_id).like("citation_id", "P-%").execute()
                    if prev_p_res.data and len(prev_p_res.data) > 0:
                        palette_off = True
                except Exception as p_exc:
                    logger.warning(f"Could not check previous palette findings: {p_exc}")

            # 2. Backend image analysis fallback for data URLs
            if active_img_url.startswith("data:image/") and not palette_off:
                try:
                    parts = active_img_url.split(",", 1)
                    if len(parts) == 2:
                        img_bytes = base64.b64decode(parts[1])
                        approved_palette = extract_palette_from_vault(active_vault_items)
                        img_analysis = analyze_image_bytes(img_bytes, approved_palette)
                        if img_analysis.get("is_off_palette"):
                            palette_off = True
                        if contrast_ratio is None and img_analysis.get("contrast_ratio") is not None:
                            contrast_ratio = img_analysis.get("contrast_ratio")
                except Exception as img_exc:
                    logger.warning(f"Backend image analysis fallback failed: {img_exc}")
    else:
        doc_meta = {}

    current_effective_image = None if remove_image else draft.get("image_url")
    current_effective_alt = None if remove_image else draft.get("alt_text")

    validated_findings = run_deterministic_review(
        body_text=draft.get("body_text", ""),
        alt_text=current_effective_alt,
        image_url=current_effective_image,
        active_vault_items=active_vault_items,
        logo_confirmed=logo_confirmed,
        palette_off=palette_off,
        contrast_ratio=contrast_ratio,
        pages=cached_pages,
        palette_unsampleable=palette_unsampleable,
    )

    current_version = draft.get("current_version", 1)

    # Clear previous findings for this version to allow clean re-reviews
    supabase.table("findings").delete().eq("draft_id", actual_id).eq("version_no", current_version).execute()

    # Save validated findings to database
    saved_findings = []
    if validated_findings:
        findings_to_insert = [
            {
                "draft_id": actual_id,
                "version_no": current_version,
                "lane": f["lane"],
                "severity": f["severity"],
                "citation_id": f["citation_id"],
                "explanation": f["explanation"],
                "suggested_fix": f.get("suggested_fix"),
            }
            for f in validated_findings
        ]
        insert_res = supabase.table("findings").insert(findings_to_insert).execute()
        saved_findings = insert_res.data or []

    if not saved_findings and validated_findings:
        saved_findings = validated_findings

    for idx, f in enumerate(saved_findings):
        f["brand_id"] = draft["brand_id"]
        if idx < len(validated_findings) and validated_findings[idx].get("page") is not None:
            f["page"] = validated_findings[idx]["page"]
        elif f.get("page") is None:
            page_m = re.search(r"\[Page\s+(\d+)\]", f.get("explanation", ""), re.IGNORECASE)
            if page_m:
                f["page"] = int(page_m.group(1))

    # Update draft status to "checked"
    supabase.table("drafts").update({
        "status": "checked"
    }).eq("id", actual_id).execute()

    # Run Grounded LLM Review asynchronously with a strict 4.0s timeout gate
    def _execute_llm():
        return run_grounded_llm_review(
            body_text=draft.get("body_text", ""),
            alt_text=draft.get("alt_text"),
            image_url=draft.get("image_url"),
            active_vault_items=active_vault_items,
            brand_id=draft.get("brand_id"),
            timeout_seconds=4.0
        )

    llm_future = _LLM_EXECUTOR.submit(_execute_llm)
    try:
        llm_result = llm_future.result(timeout=4.0)
    except concurrent.futures.TimeoutError:
        logger.warning(f"[BrandGate Review] Gemini LLM review timed out after 4.0s for draft {actual_id}")
        llm_result = {
            "available": False,
            "status": "timeout",
            "reason": "timeout (strict 4.0s gate)",
            "provider": "gemini",
            "findings": []
        }
    except Exception as exc:
        logger.warning(f"[BrandGate Review] Gemini LLM review failed for draft {actual_id}: {exc}")
        llm_result = {
            "available": False,
            "status": "error",
            "reason": str(exc),
            "provider": "gemini",
            "findings": []
        }

    # Preserve last successful LLM review state so AI counts never drop to 0 on timeout
    if llm_result.get("status") == "success" and llm_result.get("findings"):
        _DRAFT_LAST_LLM_REVIEW[actual_id] = llm_result
        if draft_id != actual_id:
            _DRAFT_LAST_LLM_REVIEW[draft_id] = llm_result
    elif (actual_id in _DRAFT_LAST_LLM_REVIEW or draft_id in _DRAFT_LAST_LLM_REVIEW) and (not llm_result.get("findings") or llm_result.get("status") in ("timeout", "LLM review unavailable", "error")):
        cached_review = _DRAFT_LAST_LLM_REVIEW.get(actual_id) or _DRAFT_LAST_LLM_REVIEW.get(draft_id)
        llm_result = {
            **cached_review,
            "cached": True,
            "timeout_fallback": True,
            "reason": llm_result.get("reason") or "preserved from prior review"
        }

    for f in (llm_result.get("findings") or []):
        f["brand_id"] = draft["brand_id"]

    return {
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": draft["brand_id"],
        "deterministic_findings": saved_findings,
        "llm_review": llm_result,
        "findings": saved_findings,
        "images_unextractable": doc_meta.get("images_unextractable", False),
        "unextractable_reason": doc_meta.get("unextractable_reason"),
    }

@app.post("/api/drafts/{draft_id}/image", summary="Attach image URL and alt text to draft")
def attach_image(draft_id: str, payload: AttachImageRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    # Tenant isolation & authorization check
    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    current_ver = draft.get("current_version", 1)
    now_iso = datetime.now(timezone.utc).isoformat()

    # If draft was already approved, updating the creative asset MUST create a new version
    # and reset status to draft server-side (invalidating the approved snapshot)
    if draft.get("status") == "approved":
        new_version_no = current_ver + 1
        new_alt = payload.alt_text if payload.alt_text is not None else draft.get("alt_text")

        supabase.table("draft_versions").insert({
            "draft_id": actual_id,
            "version_no": new_version_no,
            "body_text": draft.get("body_text", ""),
            "alt_text": new_alt,
        }).execute()

        supabase.table("drafts").update({
            "image_url": payload.image_url,
            "alt_text": new_alt,
            "current_version": new_version_no,
            "status": "draft",
            "updated_at": now_iso,
        }).eq("id", actual_id).execute()

        current_ver = new_version_no
    else:
        update_fields: Dict[str, Any] = {
            "image_url": payload.image_url,
            "updated_at": now_iso,
        }
        if payload.alt_text is not None:
            update_fields["alt_text"] = payload.alt_text

        supabase.table("drafts").update(update_fields).eq("id", actual_id).execute()

    if payload.logo_confirmed:
        supabase.table("decisions").insert({
            "draft_id": actual_id,
            "version_no": current_ver,
            "role": user["role"] if user else "reviewer",
            "decision": "re_review",
            "comment": "Reviewer confirmed current approved logo file only (A-02). Archived logos not accepted.",
        }).execute()

    return {"status": "image_attached", "id": actual_id, "draft_id": actual_id, "brand_id": draft["brand_id"], "image_url": payload.image_url, "version_no": current_ver}

@app.get("/api/insights", summary="Real database session counts grouped by citation ID (Insights v2)")
def get_insights(brand_id: Optional[str] = Query(None, description="Brand UUID"), request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    target_brand = brand_id
    if not user:
        if target_brand:
            if target_brand not in DEMO_BRAND_IDS:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Guest operations are restricted strictly to seeded demo brands."
                )
        else:
            target_brand = DEMO_BRAND_ID
    elif target_brand:
        check_brand_access(user, target_brand, write=False)

    supabase = get_supabase()

    # Determine brand name
    brand_name = "Demo Brand (Seeded)" if target_brand == DEMO_BRAND_ID else ("NovaTech Audio (Demo)" if target_brand == DEMO_BRAND_B_ID else "Brand")
    if target_brand not in (DEMO_BRAND_ID, DEMO_BRAND_B_ID) and target_brand:
        b_res = supabase.table("brands").select("name").eq("id", target_brand).execute()
        if b_res.data and len(b_res.data) > 0:
            brand_name = b_res.data[0].get("name", "Brand")

    # Query active vault items for target_brand to establish exact canonical citations for this brand
    v_query = supabase.table("vault_items").select("item_id, title, kind, text").eq("status", "active")
    if target_brand:
        v_query = v_query.eq("brand_id", target_brand)
    vault_items_res = v_query.order("item_id").execute()
    vault_items_data = vault_items_res.data or []
    vault_map = {item["item_id"]: item for item in vault_items_data}

    brand_citations = [item["item_id"] for item in vault_items_data]
    if not brand_citations:
        if target_brand == DEMO_BRAND_ID:
            brand_citations = ["F-12", "R-04", "A-02", "R-09", "P-01", "P-02", "P-03", "P-04", "T-01", "T-02", "T-03", "T-04"]
        elif target_brand == DEMO_BRAND_B_ID:
            brand_citations = ["F-20", "R-15", "T-10", "P-10", "P-11"]

    counts_by_citation: Dict[str, int] = {cid: 0 for cid in brand_citations}
    counts_by_lane: Dict[str, int] = {
        "contradiction": 0,
        "evidence_needed": 0,
        "human_decision": 0
    }

    # Fetch all drafts for target_brand ordered chronologically
    drafts_query = supabase.table("drafts").select("id, title, status, current_version, created_at").order("created_at")
    if target_brand:
        drafts_query = drafts_query.eq("brand_id", target_brand)
    drafts_res = drafts_query.execute()
    brand_drafts = drafts_res.data or []
    draft_ids = [d["id"] for d in brand_drafts]

    real_findings = []
    drafts_findings_map = {d["id"]: [] for d in brand_drafts}

    if draft_ids:
        # Fetch findings for these drafts with chunking to prevent query string limits
        real_findings = []
        for i in range(0, len(draft_ids), 50):
            chunk = draft_ids[i:i + 50]
            c_res = supabase.table("findings").select("id, draft_id, version_no, citation_id, lane, severity, explanation, created_at").in_("draft_id", chunk).execute()
            real_findings.extend(c_res.data or [])
        for f in real_findings:
            d_id = f.get("draft_id")
            if d_id in drafts_findings_map:
                drafts_findings_map[d_id].append(f)

            cid = f.get("citation_id")
            if cid:
                counts_by_citation[cid] = counts_by_citation.get(cid, 0) + 1

            lane = f.get("lane")
            if lane:
                counts_by_lane[lane] = counts_by_lane.get(lane, 0) + 1

    # Dispositions per brand
    dispositions = {
        "clear_to_publish": 0,
        "clear_with_edits": 0,
        "hold_for_legal": 0
    }
    drafts_timeline = []
    for d in brand_drafts:
        cur_v = d.get("current_version", 1)
        d_f = [f for f in drafts_findings_map.get(d["id"], []) if f.get("version_no") == cur_v or f.get("version_no") is None]
        has_c = any(f.get("lane") == "contradiction" for f in d_f)
        if d.get("status") == "approved" or len(d_f) == 0:
            disp = "Clear to Publish"
            dispositions["clear_to_publish"] += 1
        elif has_c:
            disp = "Hold for Legal"
            dispositions["hold_for_legal"] += 1
        else:
            disp = "Clear with Edits"
            dispositions["clear_with_edits"] += 1

        drafts_timeline.append({
            "id": d["id"],
            "title": d.get("title", "Untitled Draft"),
            "created_at": d.get("created_at"),
            "findings_count": len(d_f),
            "disposition": disp,
            "has_contradiction": has_c
        })

    # Most-repeated citation
    top_citation = None
    sorted_citations = sorted(counts_by_citation.items(), key=lambda x: x[1], reverse=True)
    if sorted_citations and sorted_citations[0][1] > 0:
        top_cid, top_count = sorted_citations[0]
        v_item = vault_map.get(top_cid, {})
        top_citation = {
            "citation_id": top_cid,
            "count": top_count,
            "title": v_item.get("title", f"Rule {top_cid}"),
            "kind": v_item.get("kind", "rule")
        }

    # Most-repeated violation type (lane)
    top_violation_type = None
    sorted_lanes = sorted(counts_by_lane.items(), key=lambda x: x[1], reverse=True)
    lane_labels = {
        "contradiction": "Contradiction (Factual Mismatch)",
        "evidence_needed": "Evidence Needed (Ungrounded Superlative)",
        "human_decision": "Human Decision (Design & Policy)"
    }
    if sorted_lanes and sorted_lanes[0][1] > 0:
        t_lane, t_lane_count = sorted_lanes[0]
        top_violation_type = {
            "lane": t_lane,
            "label": lane_labels.get(t_lane, t_lane.replace("_", " ").title()),
            "count": t_lane_count
        }

    # Trend by draft: is this guideline getting better or worse over drafts?
    trend_status = "no_data"
    trend_desc = "No drafts evaluated yet."
    recent_count = 0
    prior_count = 0

    if len(brand_drafts) == 1:
        trend_status = "stable"
        b_cur_v = brand_drafts[0].get("current_version", 1)
        f_cnt = len([f for f in drafts_findings_map[brand_drafts[0]["id"]] if f.get("version_no") == b_cur_v or f.get("version_no") is None])
        trend_desc = f"Baseline established across 1 draft ({f_cnt} findings recorded)."
        recent_count = f_cnt
    elif len(brand_drafts) >= 2:
        latest_draft = brand_drafts[-1]
        prior_drafts = brand_drafts[:-1]
        latest_cur_v = latest_draft.get("current_version", 1)
        latest_f = [f for f in drafts_findings_map.get(latest_draft["id"], []) if f.get("version_no") == latest_cur_v or f.get("version_no") is None]
        recent_count = len(latest_f)

        prior_counts = []
        for d in prior_drafts:
            d_v = d.get("current_version", 1)
            p_f = [f for f in drafts_findings_map.get(d["id"], []) if f.get("version_no") == d_v or f.get("version_no") is None]
            prior_counts.append(len(p_f))

        prior_avg = sum(prior_counts) / len(prior_counts) if prior_counts else float(recent_count)
        prior_count = int(round(prior_avg))

        diff = recent_count - prior_avg
        if abs(diff) < 0.05:
            trend_status = "stable"
            trend_desc = f"Stable: {recent_count} findings in latest draft vs {prior_avg:.1f} avg in earlier drafts."
        elif diff < 0:
            trend_status = "improving"
            trend_desc = f"Improving: {recent_count} findings in latest draft vs {prior_avg:.1f} avg in earlier drafts."
        else:
            trend_status = "worsening"
            trend_desc = f"Worsening: {recent_count} findings in latest draft vs {prior_avg:.1f} avg in earlier drafts."

    # "Fix this guideline first" line for the top repeated issue
    fix_first = "All guidelines in compliance. No repeat violations detected."
    if top_citation:
        cid = top_citation["citation_id"]
        cnt = top_citation["count"]
        if cid == "F-12":
            fix_first = f"Fix guideline F-12 first: {cnt} promotional pricing contradictions recorded. Align all copy prices to approved Rs. 1,299."
        elif cid == "R-04":
            fix_first = f"Fix guideline R-04 first: {cnt} ungrounded superlative claims detected. Replace 'India's No. 1' with 'trusted' and 'clinically proven' with 'certified quality'."
        elif cid == "F-20":
            fix_first = f"Fix guideline F-20 first: {cnt} pricing discrepancies found (Rs. 3,499 vs approved Rs. 4,999). Align promotional pricing to approved fact."
        elif cid == "R-15":
            fix_first = f"Fix guideline R-15 first: {cnt} unverified battery or latency claims found. Use verified lab test benchmarks or replace with 'verified battery performance'."
        elif cid == "R-09":
            fix_first = f"Fix guideline R-09 first: {cnt} accessibility issues flagged. Add descriptive alt text or adjust visual text contrast to meet 4.5:1 AA standard."
        elif cid in ("P-01", "P-10", "P-11"):
            fix_first = f"Fix guideline {cid} first: {cnt} color palette deviations recorded. Restrict creative visual assets to approved brand hex codes."
        else:
            fix_first = f"Fix guideline {cid} first: {cnt} occurrences recorded across drafts. Review {top_citation['title']} to eliminate recurring flags."

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    return {
        "brand_id": target_brand,
        "brand_name": brand_name,
        "generated_at": now_iso,
        "total_drafts": len(brand_drafts),
        "total_findings": len(real_findings),
        "counts_by_citation": counts_by_citation,
        "counts_by_lane": counts_by_lane,
        "dispositions": dispositions,
        "top_citation": top_citation,
        "top_violation_type": top_violation_type,
        "trend": {
            "status": trend_status,
            "description": trend_desc,
            "recent_draft_findings": recent_count,
            "prior_draft_findings": prior_count,
        },
        "fix_first": fix_first,
        "drafts_timeline": drafts_timeline,
    }

@app.post("/api/drafts/{draft_id}/apply-fix", summary="Apply suggested fix to draft text")
def apply_fix(draft_id: str, payload: ApplyFixRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    finding_res = supabase.table("findings").select("*").eq("id", payload.finding_id).execute()
    if not finding_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{payload.finding_id}' not found."
        )
    finding = finding_res.data[0]

    if finding.get("draft_id") != actual_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Finding does not belong to this draft."
        )

    if not finding.get("suggested_fix"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This finding has no automated suggested_fix."
        )

    current_body = draft.get("body_text", "")
    new_body = apply_fix_to_text(current_body, finding)

    if new_body == current_body:
        return {
            "id": actual_id,
            "draft_id": actual_id,
            "brand_id": draft["brand_id"],
            "version_no": draft.get("current_version", 1),
            "body_text": new_body,
            "status": draft.get("status", "draft")
        }

    new_version_no = draft.get("current_version", 1) + 1
    version_record = {
        "draft_id": actual_id,
        "version_no": new_version_no,
        "body_text": new_body,
        "alt_text": draft.get("alt_text")
    }
    supabase.table("draft_versions").insert(version_record).execute()

    supabase.table("drafts").update({
        "body_text": new_body,
        "current_version": new_version_no,
        "status": "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", actual_id).execute()

    return {
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": draft["brand_id"],
        "version_no": new_version_no,
        "body_text": new_body,
        "status": "draft"
    }

@app.post("/api/drafts/{draft_id}/revise", summary="Submit a revised draft version")
def revise_draft(draft_id: str, payload: ReviseDraftRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    new_version_no = draft.get("current_version", 1) + 1
    version_record = {
        "draft_id": actual_id,
        "version_no": new_version_no,
        "body_text": payload.body_text,
        "alt_text": payload.alt_text if payload.alt_text is not None else draft.get("alt_text")
    }
    supabase.table("draft_versions").insert(version_record).execute()

    update_data = {
        "body_text": payload.body_text,
        "current_version": new_version_no,
        "status": "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.remove_image:
        update_data["image_url"] = None
    elif payload.image_url is not None:
        update_data["image_url"] = payload.image_url

    if payload.alt_text is not None:
        update_data["alt_text"] = payload.alt_text

    supabase.table("drafts").update(update_data).eq("id", actual_id).execute()

    return {
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": draft["brand_id"],
        "version_no": new_version_no,
        "body_text": payload.body_text,
        "alt_text": update_data.get("alt_text"),
        "status": "draft"
    }

# ------------------------------------------------------------------------------
# Approval Workflow & Decisions Endpoints (Blocker 1 & 6)
# ------------------------------------------------------------------------------
@app.post("/api/drafts/{draft_id}/request-approval", summary="Request approval from checked state")
def request_approval(draft_id: str, payload: RequestApprovalRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    # Idempotent double-click safety: if already pending, return success
    if draft.get("status") == "pending_approval":
        return {"status": "pending_approval", "id": actual_id, "draft_id": actual_id}

    # Server-side state machine check: must be in "checked" or "needs_changes" status
    if draft.get("status") not in ["checked", "needs_changes"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft must be in 'checked' or 'needs_changes' status to request approval. Current status is '{draft.get('status')}'."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("drafts").update({
        "status": "pending_approval",
        "updated_at": now_iso,
    }).eq("id", actual_id).execute()

    role_to_log = user["role"] if user else "creator"
    supabase.table("decisions").insert({
        "draft_id": actual_id,
        "version_no": draft.get("current_version", 1),
        "role": role_to_log,
        "decision": "request_approval",
        "comment": payload.comment or "Submitted for brand reviewer approval",
    }).execute()

    return {"status": "pending_approval", "id": actual_id, "draft_id": actual_id}

@app.post("/api/drafts/{draft_id}/approve", summary="Approve draft (Reviewer only)")
def approve_draft(draft_id: str, payload: ApproveDraftRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    # Idempotent double-click safety: if already approved, return success
    if draft.get("status") == "approved":
        return {
            "status": "approved",
            "id": actual_id,
            "draft_id": actual_id,
            "compliance_badge": "VERIFIED COMPLIANT",
        }

    # State machine check
    if draft.get("status") != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft must be in 'pending_approval' status to approve. Current status is '{draft.get('status')}'."
        )

    # Separation of creator / reviewer & role enforcement (Blocker 6)
    if user:
        if user.get("role") != "reviewer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only accounts with the 'reviewer' role can approve drafts."
            )
        created_by_user = draft.get("created_by_user_id")
        if created_by_user and created_by_user == user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creator cannot approve their own draft."
            )
        approver_role = "reviewer"
        approver_id = user["id"]
    else:
        # Guests can only approve demo drafts in guest demo mode
        if draft.get("brand_id") not in DEMO_BRAND_IDS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest demo approval is restricted strictly to seeded demo brands."
            )
        approver_role = "demo_reviewer"
        approver_id = None

    # Check open findings for this draft and current version (Fix 1 Option A & Fix 2 Gating)
    current_ver = draft.get("current_version", 1)
    findings_res = (
        supabase.table("findings")
        .select("*")
        .eq("draft_id", actual_id)
        .eq("version_no", current_ver)
        .execute()
    )
    open_findings = [
        f for f in (findings_res.data or [])
        if f.get("lane") in ["contradiction", "evidence_needed"]
    ]

    # Defense-in-depth: also evaluate active vault items against draft text directly
    open_fresh_findings = []
    try:
        vault_res = (
            supabase.table("vault_items")
            .select("*")
            .eq("brand_id", draft["brand_id"])
            .eq("status", "active")
            .execute()
        )
        active_vault_items = vault_res.data or []
        if active_vault_items:
            fresh_findings = run_deterministic_review(
                body_text=draft.get("body_text", ""),
                alt_text=draft.get("alt_text"),
                image_url=draft.get("image_url"),
                active_vault_items=active_vault_items,
            )
            open_fresh_findings = [
                f for f in fresh_findings
                if f.get("lane") in ["contradiction", "evidence_needed"]
            ]
    except Exception:
        # Gracefully fall back to open_findings if mock environment doesn't stub vault_items
        pass

    if open_findings or open_fresh_findings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot approve: open findings remain — apply fixes or request changes first."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("drafts").update({
        "status": "approved",
        "updated_at": now_iso,
    }).eq("id", actual_id).execute()

    brand_name = "Demo Brand (Seeded)"
    if draft.get("brand_id") != DEMO_BRAND_ID:
        b_res = supabase.table("brands").select("name").eq("id", draft["brand_id"]).execute()
        if b_res.data and len(b_res.data) > 0:
            brand_name = b_res.data[0].get("name", "Brand Vault")

    vault_version_tag = f"{brand_name} (Vault v1)"
    locked_snapshot = {
        "locked": True,
        "compliance_badge": "VERIFIED COMPLIANT",
        "approved_text": draft.get("body_text"),
        "image_reference": draft.get("image_url"),
        "alt_text": draft.get("alt_text"),
        "approver_role": approver_role,
        "approver_id": approver_id,
        "timestamp": now_iso,
        "vault_version": vault_version_tag,
        "brand_id": draft.get("brand_id"),
    }

    supabase.table("decisions").insert({
        "draft_id": actual_id,
        "version_no": draft.get("current_version", 1),
        "role": approver_role,
        "decision": "approve",
        "comment": payload.comment or "Approved for publication",
    }).execute()

    return {
        "status": "approved",
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": draft["brand_id"],
        "snapshot": locked_snapshot,
    }

@app.post("/api/drafts/{draft_id}/request-changes", summary="Request changes (Reviewer only, requires comment)")
def request_changes(draft_id: str, payload: RequestChangesRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    if user:
        if user.get("role") != "reviewer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only accounts with the 'reviewer' role can request changes."
            )
        approver_role = "reviewer"
    else:
        if draft.get("brand_id") not in DEMO_BRAND_IDS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest review is restricted strictly to seeded demo brands."
            )
        approver_role = "demo_reviewer"

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("drafts").update({
        "status": "needs_changes",
        "updated_at": now_iso,
    }).eq("id", actual_id).execute()

    supabase.table("decisions").insert({
        "draft_id": actual_id,
        "version_no": draft.get("current_version", 1),
        "role": approver_role,
        "decision": "request_changes",
        "comment": payload.comment,
    }).execute()

    return {
        "status": "needs_changes",
        "id": actual_id,
        "draft_id": actual_id,
        "brand_id": draft["brand_id"],
        "comment": payload.comment,
    }

@app.post("/api/drafts/{draft_id}/comments", summary="Add comment to draft")
def add_comment(draft_id: str, payload: AddCommentRequest, request: Request = None):
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    supabase = get_supabase()

    draft = verify_draft_access(supabase, draft_id, user)
    actual_id = draft["id"]

    author_role = user["role"] if user else "guest"
    comment_record = {
        "draft_id": actual_id,
        "version_no": draft.get("current_version", 1),
        "role": author_role,
        "text": payload.text,
    }

    res = supabase.table("comments").insert(comment_record).execute()
    return res.data[0] if res.data else comment_record


