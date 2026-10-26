import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status, Query, Request
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
)
from review_engine import run_deterministic_review, apply_fix_to_text
from llm_review import run_grounded_llm_review




# Load local environment variables from .env if present (override=True ensures .env values take precedence over shell)
load_dotenv(override=True)

# Provider-mismatch diagnostic startup log (Safe: prints ONLY set, length, first 5 chars, match boolean)
_gemini_key = os.environ.get("GEMINI_API_KEY", "")
_key_set = bool(_gemini_key)
_key_len = len(_gemini_key)
_prefix = _gemini_key[:5] if _key_set else ""
_match_google = _prefix.startswith("AIza")
print(f"GEMINI_API_KEY loaded: set={_key_set}, length={_key_len}, prefix={_prefix}, provider_match_google={_match_google}")


app = FastAPI(
    title="BrandGate API",
    description="Pre-publication brand-governance gate backend API",
    version="1.0.0",
)

# Configure CORS origins
frontend_url_env = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url_env:
    for url in frontend_url_env.split(","):
        clean_url = url.strip()
        if clean_url and clean_url not in allowed_origins:
            allowed_origins.append(clean_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Explicit CORS-Guaranteed Exception Handlers (Never drop CORS on 4xx/5xx)
# ------------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    origin = request.headers.get("origin") or "http://localhost:5173"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin") or "http://localhost:5173"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


# ------------------------------------------------------------------------------
# Health Check Endpoint
# ------------------------------------------------------------------------------
@app.get("/health", summary="Health check endpoint")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------
def verify_brand_exists(supabase, brand_id: str):
    res = supabase.table("brands").select("id, name").eq("id", brand_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown brand_id: {brand_id}"
        )
    return res.data[0]

# ------------------------------------------------------------------------------
# Brands API
# ------------------------------------------------------------------------------
@app.get("/api/brands", summary="List all brands")
def list_brands():
    supabase = get_supabase()
    res = supabase.table("brands").select("*").order("name").execute()
    return res.data

# ------------------------------------------------------------------------------
# Vault Items API
# ------------------------------------------------------------------------------
@app.get("/api/brands/{brand_id}/vault", summary="List vault items grouped by kind")
def get_brand_vault(brand_id: str):
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
def create_vault_item(brand_id: str, item: VaultItemCreate):
    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    # Check duplicate (brand_id, item_id)
    existing = supabase.table("vault_items").select("id").eq("brand_id", brand_id).eq("item_id", item.item_id).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
def update_vault_item(brand_id: str, item_id: str, payload: VaultItemUpdate):
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
def delete_vault_item(brand_id: str, item_id: str):
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
def reset_demo_vault(brand_id: str):
    supabase = get_supabase()
    verify_brand_exists(supabase, brand_id)

    # 1. Clear existing items for this brand
    supabase.table("vault_items").delete().eq("brand_id", brand_id).execute()

    # 2. Re-insert the exact Phase 1 demo items
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
            "title": "Approved Term: trusted by millions",
            "text": 'Term "trusted by millions" is an approved replacement for unsupported ranking claims.',
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
    return {"status": "reset", "restored_count": len(res.data)}

# ------------------------------------------------------------------------------
# Drafts API
# ------------------------------------------------------------------------------
@app.post("/api/drafts", summary="Create a draft and version 1", status_code=status.HTTP_201_CREATED)
def create_draft(payload: DraftCreate, request: Request = None):
    supabase = get_supabase()
    verify_brand_exists(supabase, payload.brand_id)

    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)
    creator_role = user["role"] if user else payload.created_by_role

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
        # Fallback if created_by_user_id is missing or triggers schema conflict
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

@app.get("/api/drafts/{draft_id}", summary="Get draft with all versions, findings, comments, decisions")
def get_draft(draft_id: str):
    supabase = get_supabase()

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # 2. Fetch versions, findings, comments, decisions in parallel queries
    versions_res = supabase.table("draft_versions").select("*").eq("draft_id", draft_id).order("version_no").execute()
    findings_res = supabase.table("findings").select("*").eq("draft_id", draft_id).order("created_at").execute()
    comments_res = supabase.table("comments").select("*").eq("draft_id", draft_id).order("created_at").execute()
    decisions_res = supabase.table("decisions").select("*").eq("draft_id", draft_id).order("created_at").execute()

    draft["versions"] = versions_res.data or []
    draft["findings"] = findings_res.data or []
    draft["comments"] = comments_res.data or []
    draft["decisions"] = decisions_res.data or []

    # If approved, attach locked approved snapshot
    if draft.get("status") == "approved":
        approve_decision = next(
            (d for d in reversed(draft["decisions"]) if d.get("decision") == "approve"),
            None
        )
        draft["approved_snapshot"] = {
            "locked": True,
            "approved_text": draft.get("body_text"),
            "image_reference": draft.get("image_url"),
            "alt_text": draft.get("alt_text"),
            "approver_role": approve_decision.get("role") if approve_decision else "reviewer",
            "timestamp": approve_decision.get("created_at") if approve_decision else draft.get("updated_at"),
            "vault_version": f"vault-{draft['brand_id'][:8]}",
        }
    else:
        draft["approved_snapshot"] = None

    return draft


@app.get("/api/drafts", summary="List drafts for a brand (newest first)")
def list_drafts(brand_id: Optional[str] = Query(None, description="Filter drafts by brand UUID")):
    supabase = get_supabase()

    query = supabase.table("drafts").select("*")
    if brand_id:
        verify_brand_exists(supabase, brand_id)
        query = query.eq("brand_id", brand_id)

    res = query.order("created_at", desc=True).execute()
    return res.data

# ------------------------------------------------------------------------------
# Review Engine & Revision Endpoints (Phase 3)
# ------------------------------------------------------------------------------
@app.post("/api/drafts/{draft_id}/review", summary="Run deterministic server-side brand review")
def review_draft(draft_id: str, payload: Optional[ReviewDraftRequest] = None):
    supabase = get_supabase()

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # 2. Fetch ACTIVE vault items only for the draft's brand (archived items strictly excluded)
    vault_res = (
        supabase.table("vault_items")
        .select("*")
        .eq("brand_id", draft["brand_id"])
        .eq("status", "active")
        .execute()
    )
    active_vault_items = vault_res.data or []

    # 3. Run deterministic checks with citation validation
    logo_confirmed = payload.logo_confirmed if payload else False
    palette_off = payload.palette_off if payload else False
    contrast_ratio = payload.contrast_ratio if payload else None

    validated_findings = run_deterministic_review(
        body_text=draft.get("body_text", ""),
        alt_text=draft.get("alt_text"),
        image_url=draft.get("image_url"),
        active_vault_items=active_vault_items,
        logo_confirmed=logo_confirmed,
        palette_off=palette_off,
        contrast_ratio=contrast_ratio,
    )

    current_version = draft.get("current_version", 1)

    # 4. Clear any previous findings for this version to allow clean re-reviews
    supabase.table("findings").delete().eq("draft_id", draft_id).eq("version_no", current_version).execute()

    # 5. Save validated findings to database
    saved_findings = []
    if validated_findings:
        findings_to_insert = [
            {
                "draft_id": draft_id,
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

    # 6. Update draft status to "checked"
    supabase.table("drafts").update({
        "status": "checked"
    }).eq("id", draft_id).execute()

    # 7. Run Grounded LLM Review (Addition to deterministic review, strictly isolated)
    llm_result = run_grounded_llm_review(
        body_text=draft.get("body_text", ""),
        alt_text=draft.get("alt_text"),
        image_url=draft.get("image_url"),
        active_vault_items=active_vault_items,
        brand_id=draft.get("brand_id"),
        timeout_seconds=60.0
    )


    return {
        "deterministic_findings": saved_findings,
        "llm_review": llm_result,
        "findings": saved_findings
    }


@app.post("/api/drafts/{draft_id}/image", summary="Attach image URL and alt text to draft")
def attach_image(draft_id: str, payload: AttachImageRequest):
    supabase = get_supabase()

    draft_res = supabase.table("drafts").select("id").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )

    update_fields: Dict[str, Any] = {
        "image_url": payload.image_url,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.alt_text is not None:
        update_fields["alt_text"] = payload.alt_text

    supabase.table("drafts").update(update_fields).eq("id", draft_id).execute()

    # Record logo confirmation if reviewer verified it
    if payload.logo_confirmed:
        supabase.table("decisions").insert({
            "draft_id": draft_id,
            "version_no": 1,
            "role": "reviewer",
            "decision": "re_review",
            "comment": "Reviewer confirmed current approved logo file only (A-02). Archived logos not accepted.",
        }).execute()

    return {"status": "image_attached", "draft_id": draft_id, "image_url": payload.image_url}

@app.get("/api/insights", summary="Real database session counts grouped by citation ID")
def get_insights(brand_id: Optional[str] = Query(None, description="Brand UUID")):
    supabase = get_supabase()

    # Known canonical citations for zero-count inclusion
    canonical_citations = [
        "F-12", "R-04", "A-02", "R-09",
        "P-01", "P-02", "P-03", "P-04",
        "T-01", "T-02", "T-03", "T-04"
    ]

    counts_by_citation: Dict[str, int] = {cid: 0 for cid in canonical_citations}
    counts_by_lane: Dict[str, int] = {
        "contradiction": 0,
        "evidence_needed": 0,
        "human_decision": 0
    }

    # Query real findings rows from database
    query = supabase.table("findings").select("citation_id, lane")
    if brand_id:
        # Join filter by draft brand_id if provided
        drafts_res = supabase.table("drafts").select("id").eq("brand_id", brand_id).execute()
        draft_ids = [d["id"] for d in (drafts_res.data or [])]
        if draft_ids:
            query = query.in_("draft_id", draft_ids)
        else:
            return {
                "total_findings": 0,
                "counts_by_citation": counts_by_citation,
                "counts_by_lane": counts_by_lane,
            }

    findings_res = query.execute()
    real_findings = findings_res.data or []

    for f in real_findings:
        cid = f.get("citation_id")
        if cid:
            counts_by_citation[cid] = counts_by_citation.get(cid, 0) + 1

        lane = f.get("lane")
        if lane:
            counts_by_lane[lane] = counts_by_lane.get(lane, 0) + 1

    return {
        "total_findings": len(real_findings),
        "counts_by_citation": counts_by_citation,
        "counts_by_lane": counts_by_lane,
    }


@app.post("/api/drafts/{draft_id}/apply-fix", summary="Apply suggested fix to draft text")
def apply_fix(draft_id: str, payload: ApplyFixRequest):
    supabase = get_supabase()

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # 2. Fetch finding
    finding_res = supabase.table("findings").select("*").eq("id", payload.finding_id).execute()
    if not finding_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{payload.finding_id}' not found."
        )
    finding = finding_res.data[0]

    if finding.get("draft_id") != draft_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Finding does not belong to this draft."
        )

    if not finding.get("suggested_fix"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This finding has no automated suggested_fix."
        )

    # 3. Apply the fix to body_text
    current_body = draft.get("body_text", "")
    new_body = apply_fix_to_text(current_body, finding)

    # 4. Create new version
    new_version_no = draft.get("current_version", 1) + 1
    version_record = {
        "draft_id": draft_id,
        "version_no": new_version_no,
        "body_text": new_body,
        "alt_text": draft.get("alt_text")
    }
    supabase.table("draft_versions").insert(version_record).execute()

    # 5. Update draft with new version and reset status to "draft"
    supabase.table("drafts").update({
        "body_text": new_body,
        "current_version": new_version_no,
        "status": "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", draft_id).execute()

    return {
        "draft_id": draft_id,
        "version_no": new_version_no,
        "body_text": new_body,
        "status": "draft"
    }

@app.post("/api/drafts/{draft_id}/revise", summary="Submit a revised draft version")
def revise_draft(draft_id: str, payload: ReviseDraftRequest):
    supabase = get_supabase()

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # 2. Create new version
    new_version_no = draft.get("current_version", 1) + 1
    version_record = {
        "draft_id": draft_id,
        "version_no": new_version_no,
        "body_text": payload.body_text,
        "alt_text": payload.alt_text if payload.alt_text is not None else draft.get("alt_text")
    }
    supabase.table("draft_versions").insert(version_record).execute()

    # 3. Update draft and explicitly reset status to draft (clearing any approval)
    update_data = {
        "body_text": payload.body_text,
        "current_version": new_version_no,
        "status": "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.alt_text is not None:
        update_data["alt_text"] = payload.alt_text

    supabase.table("drafts").update(update_data).eq("id", draft_id).execute()

    return {
        "draft_id": draft_id,
        "version_no": new_version_no,
        "body_text": payload.body_text,
        "alt_text": update_data.get("alt_text"),
        "status": "draft"
    }

# ------------------------------------------------------------------------------
# Approval Workflow & Decisions Endpoints (Phase 5)
# ------------------------------------------------------------------------------
@app.post("/api/drafts/{draft_id}/request-approval", summary="Request approval from checked state")
def request_approval(draft_id: str, payload: RequestApprovalRequest, request: Request = None):
    supabase = get_supabase()
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # Server-side state machine check: must be in "checked" status
    if draft.get("status") not in ["checked", "needs_changes"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft must be in 'checked' status to request approval. Current status is '{draft.get('status')}'."
        )

    # 2. Advance status to pending_approval
    supabase.table("drafts").update({
        "status": "pending_approval",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", draft_id).execute()

    # 3. Record decision log entry
    role_to_log = user["role"] if user else (payload.role or "creator")
    supabase.table("decisions").insert({
        "draft_id": draft_id,
        "version_no": draft.get("current_version", 1),
        "role": role_to_log,
        "decision": "request_approval",
        "comment": payload.comment or "Submitted for brand reviewer approval",
    }).execute()

    return {"status": "pending_approval", "draft_id": draft_id}

@app.post("/api/drafts/{draft_id}/approve", summary="Approve draft (Reviewer only)")
def approve_draft(draft_id: str, payload: ApproveDraftRequest, request: Request = None):
    supabase = get_supabase()
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    # State machine check
    if draft.get("status") != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft must be in 'pending_approval' status to approve. Current status is '{draft.get('status')}'."
        )

    # Authorization & Creator separation rule
    if user:
        # If real account created this draft, they cannot approve it
        created_by_user = draft.get("created_by_user_id")
        if created_by_user and created_by_user == user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creator cannot approve their own draft."
            )
        approver_role = user.get("role", "reviewer")
    else:
        # Guest users can NEVER approve as a real account — recorded as demo_reviewer
        approver_role = "demo_reviewer"

    # 2. Transition status to approved
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("drafts").update({
        "status": "approved",
        "updated_at": now_iso,
    }).eq("id", draft_id).execute()

    # 3. Create locked snapshot
    vault_version_tag = f"vault-{draft['brand_id'][:8]}"
    locked_snapshot = {
        "locked": True,
        "approved_text": draft.get("body_text"),
        "image_reference": draft.get("image_url"),
        "alt_text": draft.get("alt_text"),
        "approver_role": approver_role,
        "approver_id": user["id"] if user else None,
        "timestamp": now_iso,
        "vault_version": vault_version_tag,
    }

    # 4. Record decision log entry
    supabase.table("decisions").insert({
        "draft_id": draft_id,
        "version_no": draft.get("current_version", 1),
        "role": approver_role,
        "decision": "approve",
        "comment": payload.comment or "Approved for publication",
    }).execute()

    return {
        "status": "approved",
        "draft_id": draft_id,
        "snapshot": locked_snapshot,
    }

@app.post("/api/drafts/{draft_id}/request-changes", summary="Request changes (Reviewer only, requires comment)")
def request_changes(draft_id: str, payload: RequestChangesRequest, request: Request = None):
    supabase = get_supabase()
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    approver_role = user["role"] if user else "demo_reviewer"

    # 2. Update status to needs_changes
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("drafts").update({
        "status": "needs_changes",
        "updated_at": now_iso,
    }).eq("id", draft_id).execute()

    # 3. Record decision log with required comment
    supabase.table("decisions").insert({
        "draft_id": draft_id,
        "version_no": draft.get("current_version", 1),
        "role": approver_role,
        "decision": "request_changes",
        "comment": payload.comment,
    }).execute()

    return {
        "status": "needs_changes",
        "draft_id": draft_id,
        "comment": payload.comment,
    }

@app.post("/api/drafts/{draft_id}/comments", summary="Add comment to draft")
def add_comment(draft_id: str, payload: AddCommentRequest, request: Request = None):
    supabase = get_supabase()
    auth_header = request.headers.get("Authorization") if request else None
    user = get_authenticated_user(auth_header)

    # 1. Fetch draft
    draft_res = supabase.table("drafts").select("id, current_version").eq("id", draft_id).execute()
    if not draft_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found."
        )
    draft = draft_res.data[0]

    author_role = user["role"] if user else (payload.role or "guest")

    comment_record = {
        "draft_id": draft_id,
        "version_no": draft.get("current_version", 1),
        "role": author_role,
        "text": payload.text,
    }

    res = supabase.table("comments").insert(comment_record).execute()
    return res.data[0] if res.data else comment_record


