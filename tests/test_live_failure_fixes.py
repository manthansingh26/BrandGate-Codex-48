import os
import re
import json
import io
import pymupdf
import urllib.request
from typing import List, Dict, Any

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def create_2page_pdf(p1_text: str, p2_text: str) -> bytes:
    doc = pymupdf.open()
    # Page 1
    page1 = doc.new_page(width=595, height=842)
    page1.insert_text((50, 72), p1_text, fontsize=12)
    # Page 2
    page2 = doc.new_page(width=595, height=842)
    page2.insert_text((50, 72), p2_text, fontsize=12)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()

def upload_pdf_draft(pdf_bytes: bytes, brand_id: str, title: str) -> Dict[str, Any]:
    boundary = "----WebKitFormBoundaryBrandGateTest"
    body = bytearray()
    
    # file field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="file"; filename="test_2page.pdf"\r\n')
    body.extend(b"Content-Type: application/pdf\r\n\r\n")
    body.extend(pdf_bytes)
    body.extend(b"\r\n")
    
    # brand_id field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="brand_id"\r\n\r\n')
    body.extend(brand_id.encode())
    body.extend(b"\r\n")

    # title field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="title"\r\n\r\n')
    body.extend(title.encode())
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/upload",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201, f"Expected 201, got {resp.status}"
        return json.loads(resp.read().decode())

def get_draft(draft_id: str) -> Dict[str, Any]:
    req = urllib.request.Request(f"{BASE_URL}/api/drafts/{draft_id}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        return json.loads(resp.read().decode())

def review_draft(draft_id: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/review",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        return json.loads(resp.read().decode())

def get_insights(brand_id: str) -> Dict[str, Any]:
    req = urllib.request.Request(f"{BASE_URL}/api/insights?brand_id={brand_id}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        return json.loads(resp.read().decode())

def test_failure_1_full_live_path():
    print("=" * 70)
    print("TESTING LIVE FAILURE 1: 2-page PDF Page badges full live path")
    print("=" * 70)

    # 2-page PDF: Page 1 Rs. 999, Page 2 India's No. 1
    page1 = "Festive Cookware offer — now for just Rs. 999 with 5-year warranty!"
    page2 = "Experience Diwali Dhamaka! India's No. 1 cookware brand for the family."
    pdf_bytes = create_2page_pdf(page1, page2)

    # 1. Upload
    print("1. Uploading 2-page PDF to /api/drafts/upload...")
    upload_res = upload_pdf_draft(pdf_bytes, BRAND_A_ID, "2-Page Badge Verification PDF")
    draft_id = upload_res["id"]
    upload_findings = upload_res["findings"]
    print(f"   Draft created with ID: {draft_id}, findings: {len(upload_findings)}")

    f12_upload = next(f for f in upload_findings if f["citation_id"] == "F-12")
    r04_upload = next(f for f in upload_findings if f["citation_id"] == "R-04")

    print(f"   Upload findings: F-12 page={f12_upload.get('page')}, R-04 page={r04_upload.get('page')}")
    assert f12_upload.get("page") == 1, f"Expected F-12 page 1, got {f12_upload.get('page')}"
    assert r04_upload.get("page") == 2, f"Expected R-04 page 2, got {r04_upload.get('page')}"

    # 2. Draft Retrieval (GET /api/drafts/{id})
    print("2. Retrieving draft from /api/drafts/{id}...")
    retrieved_draft = get_draft(draft_id)
    retrieved_findings = retrieved_draft.get("findings", [])
    f12_retrieved = next(f for f in retrieved_findings if f["citation_id"] == "F-12")
    r04_retrieved = next(f for f in retrieved_findings if f["citation_id"] == "R-04")

    print(f"   Retrieved findings: F-12 page={f12_retrieved.get('page')}, R-04 page={r04_retrieved.get('page')}")
    assert f12_retrieved.get("page") == 1, f"Expected retrieved F-12 page 1, got {f12_retrieved.get('page')}"
    assert r04_retrieved.get("page") == 2, f"Expected retrieved R-04 page 2, got {r04_retrieved.get('page')}"

    # 3. Review Endpoint (POST /api/drafts/{id}/review)
    print("3. Executing re-review on /api/drafts/{id}/review...")
    review_res = review_draft(draft_id)
    review_findings = review_res.get("findings", [])
    f12_review = next(f for f in review_findings if f["citation_id"] == "F-12")
    r04_review = next(f for f in review_findings if f["citation_id"] == "R-04")

    print(f"   Review findings: F-12 page={f12_review.get('page')}, R-04 page={r04_review.get('page')}")
    assert f12_review.get("page") == 1, f"Expected reviewed F-12 page 1, got {f12_review.get('page')}"
    assert r04_review.get("page") == 2, f"Expected reviewed R-04 page 2, got {r04_review.get('page')}"

    # 4. Finding Card badge logic simulation
    for f in [f12_retrieved, r04_retrieved]:
        page_val = f.get("page")
        badge_text = f"Page {page_val}" if page_val is not None else "NO_BADGE"
        print(f"   Card for {f['citation_id']} renders badge: [{badge_text}]")
        assert badge_text == (f"Page 1" if f["citation_id"] == "F-12" else f"Page 2")

    print("PASS: LIVE FAILURE 1 — 2-page PDF findings carry page 1 / page 2 through full upload-review-retrieval path!")

def test_failure_2_insights_api():
    print("\n" + "=" * 70)
    print("TESTING LIVE FAILURE 2: Insights API returns real non-zero data for both brands")
    print("=" * 70)

    # Brand A
    data_a = get_insights(BRAND_A_ID)
    print("Brand A Insights:")
    print(f"  total_drafts: {data_a.get('total_drafts')}")
    print(f"  total_findings: {data_a.get('total_findings')}")
    print(f"  top_citation: {data_a.get('top_citation')}")
    print(f"  top_violation_type: {data_a.get('top_violation_type')}")
    print(f"  trend: {data_a.get('trend')}")
    print(f"  fix_first: {data_a.get('fix_first')}")
    print(f"  dispositions: {data_a.get('dispositions')}")

    assert data_a.get("total_drafts", 0) > 0, "Brand A total_drafts must be > 0"
    assert data_a.get("top_citation") is not None, "Brand A top_citation must not be None"
    assert data_a["top_citation"]["citation_id"] == "R-04", f"Brand A top citation should be R-04, got {data_a['top_citation']}"
    assert data_a["top_citation"]["count"] >= 309, f"Brand A R-04 count should be >= 309, got {data_a['top_citation']['count']}"
    assert data_a.get("top_violation_type") is not None, "Brand A top_violation_type must not be None"
    assert data_a["top_violation_type"]["lane"] == "evidence_needed", "Brand A top lane should be evidence_needed"
    assert data_a.get("trend") is not None and data_a["trend"]["status"] != "no_data", "Brand A trend must have status"
    assert "Fix guideline R-04 first" in data_a.get("fix_first", ""), f"Brand A fix_first should mention R-04: {data_a.get('fix_first')}"
    assert data_a.get("dispositions", {}).get("hold_for_legal", 0) > 0, "Brand A hold_for_legal must be > 0"
    print("  -> Brand A PASS")

    # Brand B
    data_b = get_insights(BRAND_B_ID)
    print("\nBrand B Insights:")
    print(f"  total_drafts: {data_b.get('total_drafts')}")
    print(f"  total_findings: {data_b.get('total_findings')}")
    print(f"  top_citation: {data_b.get('top_citation')}")
    print(f"  top_violation_type: {data_b.get('top_violation_type')}")
    print(f"  trend: {data_b.get('trend')}")
    print(f"  fix_first: {data_b.get('fix_first')}")
    print(f"  dispositions: {data_b.get('dispositions')}")

    assert data_b.get("total_drafts", 0) > 0, "Brand B total_drafts must be > 0"
    assert data_b.get("top_citation") is not None, "Brand B top_citation must not be None"
    assert data_b["top_citation"]["citation_id"] == "R-15", f"Brand B top citation should be R-15, got {data_b['top_citation']}"
    assert data_b["top_citation"]["count"] >= 52, f"Brand B R-15 count should be >= 52, got {data_b['top_citation']['count']}"
    assert data_b.get("top_violation_type") is not None, "Brand B top_violation_type must not be None"
    assert data_b["top_violation_type"]["lane"] == "evidence_needed", "Brand B top lane should be evidence_needed"
    assert data_b.get("trend") is not None and data_b["trend"]["status"] != "no_data", "Brand B trend must have status"
    assert "Fix guideline R-15 first" in data_b.get("fix_first", ""), f"Brand B fix_first should mention R-15: {data_b.get('fix_first')}"
    assert data_b.get("dispositions", {}).get("hold_for_legal", 0) > 0, "Brand B hold_for_legal must be > 0"
    print("  -> Brand B PASS")

    print("\nPASS: LIVE FAILURE 2 — Insights API returns non-zero top citation, trend, fix-first and dispositions matching distribution totals for both brands!")

if __name__ == "__main__":
    test_failure_1_full_live_path()
    test_failure_2_insights_api()
    print("\n" + "=" * 70)
    print("ALL LIVE FAILURE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
