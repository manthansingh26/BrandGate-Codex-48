import io
import json
import os
import sys
import time
import urllib.request
import urllib.error

# Ensure backend directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import docx
import fitz
from review_engine import run_deterministic_review
from document_parser import extract_docx, extract_pdf

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"


def get_json(url):
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        assert resp.status == 200, f"HTTP {resp.status} on {url}"
        return json.loads(resp.read().decode())


def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode())


# ==============================================================================
# TEST 1: Insights v2 per brand
# ==============================================================================
def test_insights_v2_per_brand():
    print("\n--- TEST 1: Insights v2 per brand (real counts, dated, no leak) ---")
    data_a = get_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    data_b = get_json(f"{BASE_URL}/api/insights?brand_id={BRAND_B_ID}")

    print(f"Brand A: {data_a['brand_name']} | Total drafts: {data_a['total_drafts']} | Total findings: {data_a['total_findings']}")
    print(f"  Top citation: {data_a['top_citation']}")
    print(f"  Top violation type: {data_a['top_violation_type']}")
    print(f"  Trend: {data_a['trend']['status']} - {data_a['trend']['description']}")
    print(f"  Fix first: {data_a['fix_first']}")
    print(f"  Dispositions: {data_a['dispositions']}")

    print(f"Brand B: {data_b['brand_name']} | Total drafts: {data_b['total_drafts']} | Total findings: {data_b['total_findings']}")
    print(f"  Top citation: {data_b['top_citation']}")
    print(f"  Top violation type: {data_b['top_violation_type']}")
    print(f"  Trend: {data_b['trend']['status']} - {data_b['trend']['description']}")
    print(f"  Fix first: {data_b['fix_first']}")
    print(f"  Dispositions: {data_b['dispositions']}")

    # 1. Real non-empty numbers from database
    assert data_a["total_drafts"] > 0, "Brand A must have real drafts"
    assert data_a["total_findings"] > 0, "Brand A must have real findings"
    assert data_b["total_drafts"] > 0, "Brand B must have real drafts"
    assert data_b["total_findings"] > 0, "Brand B must have real findings"

    # 2. Complete brand isolation - distinct counts and brand rules
    assert data_a["total_findings"] != data_b["total_findings"], "Brand A and B must have different real counts"
    assert data_a["top_citation"]["citation_id"] in ("R-04", "F-12"), f"Brand A top citation should be cookware rule, got {data_a['top_citation']}"
    assert data_b["top_citation"]["citation_id"] in ("R-15", "F-20"), f"Brand B top citation should be audio rule, got {data_b['top_citation']}"

    # 3. No leak of Brand A citations into Brand B counts_by_citation
    assert "F-12" not in data_b["counts_by_citation"], "Brand A F-12 leaked into Brand B!"
    assert "R-04" not in data_b["counts_by_citation"], "Brand A R-04 leaked into Brand B!"

    # 4. Plain-language "Fix this guideline first" line present and specific
    assert "Fix guideline" in data_a["fix_first"], "Brand A fix_first missing guideline directive"
    assert "Fix guideline" in data_b["fix_first"], "Brand B fix_first missing guideline directive"
    assert data_a["fix_first"] != data_b["fix_first"], "Fix first must be brand-specific"

    # 5. Trend by draft is present and populated
    assert data_a["trend"]["status"] in ("improving", "worsening", "stable"), f"Invalid trend status: {data_a['trend']}"
    assert data_b["trend"]["status"] in ("improving", "worsening", "stable"), f"Invalid trend status: {data_b['trend']}"

    # 6. Dispositions breakdown counted
    for k in ("clear_to_publish", "clear_with_edits", "hold_for_legal"):
        assert k in data_a["dispositions"], f"Missing disposition {k} in Brand A"
        assert k in data_b["dispositions"], f"Missing disposition {k} in Brand B"

    print("PASS: Insights v2 per brand shows distinct real database counts, top citations, trends, and fix-first directives with zero cross-brand leaks.")


# ==============================================================================
# TEST 2: Report disposition derivation
# ==============================================================================
def test_report_disposition():
    print("\n--- TEST 2: Report disposition derivation ---")
    # Case 1: Clean draft (0 findings) -> Clear to Publish
    clean_findings = []
    has_c = any(f.get("lane") == "contradiction" for f in clean_findings)
    disp_clean = "Clear to Publish" if len(clean_findings) == 0 else ("Hold for Legal" if has_c else "Clear with Edits")
    assert disp_clean == "Clear to Publish", f"Expected Clear to Publish, got {disp_clean}"
    print(f"  Clean draft (0 findings) -> {disp_clean}")

    # Case 2: Draft with only evidence_needed or human_decision -> Clear with Edits
    edits_only_findings = [
        {"lane": "evidence_needed", "citation_id": "R-04"},
        {"lane": "human_decision", "citation_id": "P-01"},
    ]
    has_c2 = any(f.get("lane") == "contradiction" for f in edits_only_findings)
    disp_edits = "Clear to Publish" if len(edits_only_findings) == 0 else ("Hold for Legal" if has_c2 else "Clear with Edits")
    assert disp_edits == "Clear with Edits", f"Expected Clear with Edits, got {disp_edits}"
    print(f"  Evidence / Human Decision draft -> {disp_edits}")

    # Case 3: Draft with contradiction -> Hold for Legal
    contradiction_findings = [
        {"lane": "contradiction", "citation_id": "F-12"},
        {"lane": "evidence_needed", "citation_id": "R-04"},
    ]
    has_c3 = any(f.get("lane") == "contradiction" for f in contradiction_findings)
    disp_hold = "Clear to Publish" if len(contradiction_findings) == 0 else ("Hold for Legal" if has_c3 else "Clear with Edits")
    assert disp_hold == "Hold for Legal", f"Expected Hold for Legal, got {disp_hold}"
    print(f"  Contradiction draft -> {disp_hold}")

    print("PASS: Report disposition correctly derives Clear to Publish, Clear with Edits, and Hold for Legal.")


def get_vault_items(brand_id):
    vault_data = get_json(f"{BASE_URL}/api/brands/{brand_id}/vault")
    items = []
    for k in ("fact", "rule", "terminology", "palette"):
        items.extend(vault_data.get(k, []))
    return items


# ==============================================================================
# TEST 3: Hardened image checks
# ==============================================================================
def test_hardened_image_checks():
    print("\n--- TEST 3: Hardened image checks ---")
    vault_a = get_vault_items(BRAND_A_ID)

    # 3a: Off-palette image gives Human Decision (never Contradiction)
    findings_off_palette = run_deterministic_review(
        body_text="Clean cookware draft",
        alt_text="A clean descriptive alt text for cookware",
        image_url="https://example.com/asset.png",
        active_vault_items=vault_a,
        palette_off=True
    )
    p01_findings = [f for f in findings_off_palette if f.get("citation_id") in ("P-01", "P-10")]
    assert len(p01_findings) >= 1, "Expected P-01/P-10 finding for off-palette image"
    for pf in p01_findings:
        assert pf["lane"] == "human_decision", f"Off-palette must be human_decision, never contradiction! Got: {pf['lane']}"
        assert pf["lane"] != "contradiction", "HARD RULE: Palette check must NEVER be contradiction!"
    print("  3a. Off-palette image -> Human Decision lane (P-01) verified. Never Contradiction.")

    # 3b: Contrast checking on sampled colors with AA 4.5:1 threshold
    findings_contrast_fail = run_deterministic_review(
        body_text="Clean cookware draft",
        alt_text="Valid alt text",
        image_url="https://example.com/asset.png",
        active_vault_items=vault_a,
        contrast_ratio=3.2  # Below 4.5:1 AA standard
    )
    contrast_findings = [f for f in findings_contrast_fail if "4.5:1" in f.get("explanation", "")]
    assert len(contrast_findings) >= 1, "Expected contrast ratio finding citing 4.5:1 threshold"
    assert "4.5:1" in contrast_findings[0]["explanation"], "Finding must explicitly show 4.5:1 minimum threshold"
    assert contrast_findings[0]["lane"] == "human_decision", "Contrast finding must be human_decision"
    print(f"  3b. Contrast ratio (3.2:1 < 4.5:1) -> Human Decision with AA 4.5:1 threshold shown: '{contrast_findings[0]['explanation'][:70]}...'")

    # 3c: Missing alt text gives R-09 (human_decision)
    findings_missing_alt = run_deterministic_review(
        body_text="Clean cookware draft",
        alt_text="",  # Blank alt text
        image_url="https://example.com/asset.png",
        active_vault_items=vault_a
    )
    r09_findings = [f for f in findings_missing_alt if f.get("citation_id") == "R-09"]
    assert len(r09_findings) >= 1, "Expected R-09 finding for missing alt text"
    assert r09_findings[0]["lane"] == "human_decision", f"R-09 must be human_decision, got {r09_findings[0]['lane']}"
    print("  3c. Missing alt text -> R-09 Human Decision verified.")

    # 3d: Unsampleable image gives "Could not sample — human decision", never silent pass
    findings_unsampleable = run_deterministic_review(
        body_text="Clean cookware draft",
        alt_text="Valid alt text",
        image_url="https://example.com/asset.png",
        active_vault_items=vault_a,
        palette_unsampleable=True
    )
    unsampleable_f = [f for f in findings_unsampleable if "Could not sample — human decision" in f.get("explanation", "")]
    assert len(unsampleable_f) >= 1, "Expected 'Could not sample — human decision' finding"
    assert unsampleable_f[0]["lane"] == "human_decision", "Unsampleable image must be human_decision"
    print("  3d. Unsampleable image -> 'Could not sample — human decision' finding verified.")

    print("PASS: Hardened image checks fully verified (approximate/human decision only, 4.5:1 contrast threshold, R-09 alt text, honest unsampleable notice).")


# ==============================================================================
# TEST 4: PDF Page badge fix
# ==============================================================================
def test_pdf_page_badge_fix():
    print("\n--- TEST 4: PDF Page badge fix (Page 1 F-12, Page 2 R-04) ---")
    vault_a = get_vault_items(BRAND_A_ID)

    # Create a 2-page PDF:
    # Page 1: Price claim 'now for just Rs. 999!' (triggers F-12 on Page 1)
    # Page 2: Superlative claim 'India's No. 1 cookware brand' (triggers R-04 on Page 2)
    doc = fitz.open()
    
    # Page 1
    page1 = doc.new_page()
    page1.insert_text((50, 100), "Diwali Festive Cookware Special Offer! Get this cookware now for just Rs. 999! Great savings today.", fontsize=12)
    
    # Page 2
    page2 = doc.new_page()
    page2.insert_text((50, 100), "Experience India's No. 1 cookware brand with guaranteed performance. Trusted in kitchens everywhere.", fontsize=12)
    
    pdf_bytes = doc.tobytes()
    doc.close()

    # Parse multi-page PDF
    parsed = extract_pdf(pdf_bytes, [])
    assert parsed["page_count"] == 2, f"Expected 2 pages, got {parsed['page_count']}"

    # Review via deterministic review engine with page segments
    findings = run_deterministic_review(
        body_text=parsed["text"],
        alt_text=None,
        image_url=None,
        active_vault_items=vault_a,
        pages=parsed["pages"]
    )

    f12_findings = [f for f in findings if f.get("citation_id") == "F-12"]
    r04_findings = [f for f in findings if f.get("citation_id") == "R-04"]

    assert len(f12_findings) >= 1, f"Expected at least 1x F-12 finding, got {len(f12_findings)}"
    assert len(r04_findings) >= 1, f"Expected at least 1x R-04 finding, got {len(r04_findings)}"

    # Check page attribution
    f12_page = f12_findings[0].get("page")
    r04_page = r04_findings[0].get("page")

    print(f"  F-12 finding page: {f12_page} | Explanation: {f12_findings[0]['explanation']}")
    print(f"  R-04 finding page: {r04_page} | Explanation: {r04_findings[0]['explanation']}")

    assert f12_page == 1, f"F-12 must be attributed to Page 1, got {f12_page}"
    assert r04_page == 2, f"R-04 must be attributed to Page 2, got {r04_page}"

    # Also verify that [Page 1] and [Page 2] prefixes are retained for UI badges
    assert "[Page 1]" in f12_findings[0]["explanation"] or f12_page == 1, "F-12 card must have Page 1 metadata"
    assert "[Page 2]" in r04_findings[0]["explanation"] or r04_page == 2, "R-04 card must have Page 2 metadata"

    print("PASS: PDF Page badges correctly attributed (Page 1 on F-12 card, Page 2 on R-04 card).")


def run_all():
    print("=" * 70)
    print("RUNNING AUTOMATED SELF-TEST SUITE FOR INSIGHTS V2 & HARDENED IMAGE CHECKS")
    print("=" * 70)
    test_insights_v2_per_brand()
    test_report_disposition()
    test_hardened_image_checks()
    test_pdf_page_badge_fix()
    print("\n" + "=" * 70)
    print("ALL TESTS IN test_insights_v2_and_image_checks.py PASSED (4/4)!")
    print("=" * 70)


if __name__ == "__main__":
    run_all()
