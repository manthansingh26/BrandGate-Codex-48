import os
import sys
import json
import re
from typing import Dict, Any

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from retrieval import retrieve_relevant_vault_items, keyword_retrieval_fallback
from review_engine import run_deterministic_review, apply_fix_to_text, validate_citations
from llm_review import run_grounded_llm_review, parse_gemini_response

def run_tests():
    print("=" * 60)
    print("STARTING AUTOMATED VERIFICATION SUITE (GEMINI + PHASE 7)")
    print("=" * 60)

    # Active Vault Items matching Phase 1 Seed Data
    active_vault_items = [
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "F-12",
            "kind": "fact",
            "title": "Festive Cookware Promotional Price",
            "text": "Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026.",
            "status": "active"
        },
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "R-04",
            "kind": "rule",
            "title": "Superlatives & Ranking Claims Require Approved Evidence",
            "text": "Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.",
            "status": "active"
        },
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "A-02",
            "kind": "rule",
            "title": "Approved Current Logo Requirement",
            "text": "Current approved logo file only; archived logo is not accepted.",
            "status": "active"
        },
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "R-09",
            "kind": "rule",
            "title": "Mandatory Descriptive Image Alt Text",
            "text": "Every creative requires descriptive alt text.",
            "status": "active"
        },
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "P-01",
            "kind": "palette",
            "title": "Primary Brand Blue",
            "text": "#1E3A8A - Seeded Primary Blue",
            "status": "active"
        }
    ]

    demo_text = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"

    # --------------------------------------------------------------------------
    # 1. Deterministic Review on Demo Draft
    # --------------------------------------------------------------------------
    findings = run_deterministic_review(
        body_text=demo_text,
        alt_text=None,
        image_url=None,
        active_vault_items=active_vault_items
    )
    print(f"[TEST 1] Deterministic findings count: {len(findings)}")
    f12 = next((f for f in findings if f["citation_id"] == "F-12"), None)
    r04_list = [f for f in findings if f["citation_id"] == "R-04"]
    uncited = [f for f in findings if not f.get("citation_id")]

    assert f12 is not None and f12["lane"] == "contradiction" and f12["suggested_fix"] == "Rs. 1,299"
    assert len(r04_list) == 2 and all(f["lane"] == "evidence_needed" for f in r04_list)
    assert len(uncited) == 0
    print("PASS: 1 - Deterministic safety net: F-12 contradiction, 2x R-04 evidence needed, 0 uncited")

    # --------------------------------------------------------------------------
    # 2. Text clean replacement (No leftover "No. 1")
    # --------------------------------------------------------------------------
    current_text = demo_text
    current_text = apply_fix_to_text(current_text, f12)
    for f in r04_list:
        current_text = apply_fix_to_text(current_text, f)

    print(f"[TEST 2] Text after all fixes: '{current_text}'")
    assert "no. 1" not in current_text.lower(), f"Failed: 'No. 1' still present in '{current_text}'"
    assert "Rs. 1,299" in current_text, f"Failed: 'Rs. 1,299' not present in '{current_text}'"
    print("PASS: 2 - Clean replacement: Zero 'No. 1' fragments remain, price is Rs. 1,299")

    # --------------------------------------------------------------------------
    # 3. Keyword Retrieval Fallback (1e)
    # --------------------------------------------------------------------------
    retrieved = retrieve_relevant_vault_items(
        draft_text=demo_text,
        active_vault_items=active_vault_items,
        limit=5,
        force_fallback=True
    )
    retrieved_ids = [item["item_id"] for item in retrieved]
    print(f"[TEST 3] Keyword retrieval IDs: {retrieved_ids}")
    assert "F-12" in retrieved_ids and "R-04" in retrieved_ids
    assert len(retrieved) <= 5
    print("PASS: 3 - Keyword retrieval fallback returned relevant items F-12 and R-04")

    # --------------------------------------------------------------------------
    # 4. LLM Review without Key (1b)
    # --------------------------------------------------------------------------
    # Save environment state
    saved_env = {
        "LLM_PROVIDER": os.environ.get("LLM_PROVIDER"),
        "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY"),
        "LLM_API_KEY": os.environ.get("LLM_API_KEY"),
        "LLM_MODEL": os.environ.get("LLM_MODEL"),
    }

    try:
        # Clear keys to simulate unconfigured state
        os.environ["LLM_PROVIDER"] = "gemini"
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("LLM_API_KEY", None)

        unavail_res = run_grounded_llm_review(
            body_text=demo_text,
            alt_text=None,
            image_url=None,
            active_vault_items=active_vault_items,
            timeout_seconds=1.0
        )
        print(f"[TEST 4] Unconfigured key status: {unavail_res['status']} | Reason: '{unavail_res['reason']}'")
        assert unavail_res["available"] is False
        assert unavail_res["status"] == "LLM review unavailable"
        assert unavail_res["reason"] == "key not set"
        assert unavail_res["provider"] == "gemini"
        assert len(unavail_res["findings"]) == 0
        print("PASS: 4 - Transparent 'LLM review unavailable (key not set)' without crashing")

        # ----------------------------------------------------------------------
        # 5. Gemini Test-Only Dummy Key Path (1c)
        # ----------------------------------------------------------------------
        # Set dummy Gemini key in test-only run without touching real .env
        os.environ["LLM_PROVIDER"] = "gemini"
        os.environ["GEMINI_API_KEY"] = "AIzaSyDUMMY_KEY_FOR_TEST_ONLY_12345"
        os.environ["LLM_MODEL"] = "gemini-2.5-flash"

        dummy_res = run_grounded_llm_review(
            body_text=demo_text,
            alt_text=None,
            image_url=None,
            active_vault_items=active_vault_items,
            timeout_seconds=2.0
        )
        print(f"[TEST 5] Gemini dummy key status: {dummy_res['status']} | Reason: '{dummy_res['reason']}' | Provider: '{dummy_res['provider']}'")
        assert dummy_res["available"] is False
        assert dummy_res["status"] == "LLM review unavailable"
        # Reason changes from "key not set" to "invalid key" (HTTP 400 from Google), proving Gemini code path
        assert dummy_res["reason"] in ["invalid key", "model not found", "timeout", "connection error", "invalid request (INVALID_ARGUMENT)"]
        assert dummy_res["provider"] == "gemini"
        print(f"PASS: 5 - Gemini path verified: Reason changed from 'key not set' to '{dummy_res['reason']}'")


        # ----------------------------------------------------------------------
        # 6. Unit-test Gemini Response Parser with Mocked Google Format (1d)
        # ----------------------------------------------------------------------
        # Simulates candidates[0].content.parts[0].text output
        mocked_google_text = json.dumps([
            {
                "lane": "contradiction",
                "severity": "high",
                "citation_id": "F-12",
                "explanation": "Price contradicts approved fact F-12",
                "suggested_fix": "Rs. 1,299"
            },
            {
                "lane": "contradiction",
                "severity": "medium",
                "citation_id": "UNKNOWN-99", # Uncited / not in retrieved vault!
                "explanation": "Invented guideline with unretrieved citation",
                "suggested_fix": None
            }
        ])

        parsed_findings = parse_gemini_response(mocked_google_text, retrieved)
        print(f"[TEST 6] Mocked response findings count after citation validator: {len(parsed_findings)}")
        # Valid finding citing F-12 must pass
        assert any(f["citation_id"] == "F-12" for f in parsed_findings), "Valid F-12 finding was not parsed"
        # Invalid finding citing UNKNOWN-99 must be DROPPED
        assert not any(f["citation_id"] == "UNKNOWN-99" for f in parsed_findings), "Citation validator failed to drop UNKNOWN-99"
        print("PASS: 6 - Mocked Gemini parser: Valid F-12 passed, uncited UNKNOWN-99 dropped by Citation Validator")

    finally:
        # Restore environment variables exactly
        for k, v in saved_env.items():
            if v is not None:
                os.environ[k] = v
            else:
                os.environ.pop(k, None)

    print("=" * 60)
    print("ALL GEMINI & PHASE 7 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
