"""
test_document_governance.py

Automated test suite verifying DOCX and PDF document governance:
1. File size limit enforcement (10MB limit).
2. Test (a): Brand A DOCX containing "India's No. 1" + Rs. 999 produces the same F-12 + R-04 pattern as the text demo draft.
3. Test (b): Clean Brand A DOCX produces 0 Contradictions.
4. Test (c): Brand A PDF with off-palette image + blank alt produces palette Human Decision + R-09.
5. Test (d): Brand B DOCX with Rs. 3,499 + 80-hour battery produces 1x F-20 + 2x R-15 with ZERO Brand A citations.
6. Honest limits: Scanned PDF with no text layer raises honest limit notice without claiming OCR.
7. Unextractable images: Flagged honestly as "Image could not be extracted — check manually", never a fake pass.
"""

import io
import sys
import docx
import fitz
import httpx
from PIL import Image

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

client = httpx.Client(base_url=BASE_URL, timeout=30.0)

def create_docx_bytes(paragraphs: list[str]) -> bytes:
    doc = docx.Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def create_pdf_bytes(pages_text: list[str]) -> bytes:
    doc = fitz.open()
    for text in pages_text:
        page = doc.new_page()
        page.insert_text((50, 72), text, fontsize=12)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def create_pdf_with_image_bytes(text: str, image_color=(255, 0, 0)) -> bytes:
    # Off-palette red color (255, 0, 0)
    img = Image.new("RGB", (120, 120), color=image_color)
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_data = img_buf.getvalue()

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text, fontsize=12)
    rect = fitz.Rect(50, 80, 200, 230)
    page.insert_image(rect, stream=img_data)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def create_scanned_pdf_bytes() -> bytes:
    # Only image, zero text layer
    img = Image.new("RGB", (300, 300), color=(240, 240, 240))
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_data = img_buf.getvalue()

    doc = fitz.open()
    page = doc.new_page()
    rect = fitz.Rect(20, 20, 320, 320)
    page.insert_image(rect, stream=img_data)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_brand_a_docx():
    print("\n--- Test (a): Brand A DOCX ('India\'s No. 1' + Rs. 999) ---")
    content = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"
    docx_bytes = create_docx_bytes([content])

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("festive_cookware_draft.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"brand_id": BRAND_A_ID, "title": "Brand A Festive DOCX"}
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    findings = data.get("findings", [])

    f12 = [f for f in findings if f.get("citation_id") == "F-12"]
    r04 = [f for f in findings if f.get("citation_id") == "R-04"]

    assert len(f12) == 1, f"Expected 1x F-12, got {len(f12)}"
    assert f12[0]["lane"] == "contradiction", f"F-12 must be contradiction, got {f12[0]['lane']}"
    assert "Rs. 999" in f12[0]["explanation"]
    assert f12[0].get("suggested_fix") == "Rs. 1,299"

    assert len(r04) == 2, f"Expected 2x R-04, got {len(r04)}"
    assert all(f["lane"] == "evidence_needed" for f in r04), "All R-04 must be evidence_needed lane"
    assert any("No. 1" in f["explanation"] for f in r04)
    assert any("clinically proven" in f["explanation"] for f in r04)

    # Verify brand_id is preserved
    assert data.get("brand_id") == BRAND_A_ID
    assert all(f.get("brand_id") == BRAND_A_ID for f in findings)
    print("PASS: Brand A DOCX produces exact 1x F-12 + 2x R-04 pattern as text demo draft.")


def test_clean_brand_a_docx():
    print("\n--- Test (b): Clean Brand A DOCX produces 0 Contradictions ---")
    clean_content = "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"
    docx_bytes = create_docx_bytes([clean_content])

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("clean_cookware_draft.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"brand_id": BRAND_A_ID, "title": "Brand A Clean DOCX"}
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    findings = data.get("findings", [])

    contradictions = [f for f in findings if f.get("lane") == "contradiction"]
    evidence_needed = [f for f in findings if f.get("lane") == "evidence_needed"]

    assert len(contradictions) == 0, f"Expected 0 contradictions, got: {contradictions}"
    assert len(evidence_needed) == 0, f"Expected 0 evidence needed, got: {evidence_needed}"
    print("PASS: Clean Brand A DOCX produces 0 Contradictions and 0 Evidence Needed.")


def test_brand_a_pdf_with_image():
    print("\n--- Test (c): Brand A PDF with off-palette image + blank alt produces palette Human Decision + R-09 ---")
    text = "Experience our premium festive cookware collection for modern homes."
    pdf_bytes = create_pdf_with_image_bytes(text, image_color=(255, 20, 20))  # Off-palette bright red

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("cookware_visual.pdf", pdf_bytes, "application/pdf")},
        data={"brand_id": BRAND_A_ID, "title": "Brand A Visual PDF", "alt_text": ""}
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    findings = data.get("findings", [])

    palette_findings = [f for f in findings if f.get("citation_id") == "P-01"]
    r09_findings = [f for f in findings if f.get("citation_id") == "R-09"]

    assert len(palette_findings) >= 1, f"Expected at least 1 palette finding (P-01), got: {palette_findings}"
    assert palette_findings[0]["lane"] == "human_decision", f"Palette finding lane must be human_decision, got {palette_findings[0]['lane']}"

    assert len(r09_findings) >= 1, f"Expected at least 1 R-09 alt-text finding, got: {r09_findings}"
    assert r09_findings[0]["lane"] == "human_decision", f"R-09 lane must be human_decision, got {r09_findings[0]['lane']}"

    print(f"PASS: Brand A PDF produced palette Human Decision ({palette_findings[0]['citation_id']}) and alt-text Human Decision ({r09_findings[0]['citation_id']}).")


def test_brand_b_docx():
    print("\n--- Test (d): Brand B DOCX with Rs. 3,499 + 80-hour battery produces 1x F-20 + 2x R-15 with ZERO Brand A citations ---")
    b_text = "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!"
    docx_bytes = create_docx_bytes([b_text])

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("novatech_creative.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"brand_id": BRAND_B_ID, "title": "Brand B NovaTech DOCX"}
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    findings = data.get("findings", [])

    f20 = [f for f in findings if f.get("citation_id") == "F-20"]
    r15 = [f for f in findings if f.get("citation_id") == "R-15"]

    assert len(f20) == 1, f"Expected 1x F-20, got {len(f20)}: {f20}"
    assert f20[0]["lane"] == "contradiction", f"F-20 lane must be contradiction, got {f20[0]['lane']}"
    assert "Rs. 3,499" in f20[0]["explanation"]

    assert len(r15) == 2, f"Expected 2x R-15, got {len(r15)}: {r15}"
    assert all(f["lane"] == "evidence_needed" for f in r15), f"R-15 findings must be evidence_needed: {r15}"

    # ZERO Brand A citations
    brand_a_citations = {"F-12", "R-04", "A-02", "R-09", "P-01", "P-02", "P-03", "P-04", "T-01", "T-02", "T-03", "T-04"}
    b_citations = {f.get("citation_id") for f in findings}
    leaked = b_citations.intersection(brand_a_citations)
    assert len(leaked) == 0, f"Brand A citations leaked into Brand B review: {leaked}"

    # Brand ID validation
    assert data.get("brand_id") == BRAND_B_ID
    assert all(f.get("brand_id") == BRAND_B_ID for f in findings)
    print("PASS: Brand B DOCX produces 1x F-20 + 2x R-15 with ZERO Brand A citations.")


def test_scanned_pdf_honest_limit():
    print("\n--- Honest Limit Test: Scanned-image PDF with no text layer ---")
    scanned_bytes = create_scanned_pdf_bytes()

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("scanned_invoice.pdf", scanned_bytes, "application/pdf")},
        data={"brand_id": BRAND_A_ID, "title": "Scanned Document"}
    )
    assert response.status_code == 400, f"Expected 400 rejection for scanned PDF with no text layer, got {response.status_code}"
    detail = response.json().get("detail", "")
    assert "no text layer" in detail.lower() or "ocr" in detail.lower(), f"Unexpected error detail: {detail}"
    print(f"PASS: Scanned-image PDF with no text layer rejected with honest limit message: '{detail}'")


def test_pdf_page_order_and_citation():
    print("\n--- PDF Page-Order & Page Citation Test ---")
    page1_text = "Diwali Dhamaka! India's No. 1 cookware brand for every Indian home."
    page2_text = "Special festive offer: clinically proven non-stick — now for just Rs. 999!"
    pdf_bytes = create_pdf_bytes([page1_text, page2_text])

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("multipage_cookware.pdf", pdf_bytes, "application/pdf")},
        data={"brand_id": BRAND_A_ID, "title": "Multi-page Cookware PDF"}
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    findings = data.get("findings", [])

    # Check page citations
    # Page 1 contains "India's No. 1"
    # Page 2 contains "clinically proven" and "Rs. 999"
    f12 = [f for f in findings if f.get("citation_id") == "F-12"][0]
    r04_p1 = [f for f in findings if f.get("citation_id") == "R-04" and "no. 1" in f.get("explanation", "").lower()][0]
    r04_p2 = [f for f in findings if f.get("citation_id") == "R-04" and "clinically" in f.get("explanation", "").lower()][0]

    assert "[Page 1]" in r04_p1["explanation"], f"Expected [Page 1] in finding explanation, got: {r04_p1['explanation']}"
    assert "[Page 2]" in r04_p2["explanation"], f"Expected [Page 2] in finding explanation, got: {r04_p2['explanation']}"
    assert "[Page 2]" in f12["explanation"], f"Expected [Page 2] in finding explanation, got: {f12['explanation']}"

    print("PASS: Multi-page PDF text extracted in page order with page numbers cited accurately ([Page 1], [Page 2]).")


def test_file_size_limit_10mb():
    print("\n--- 10MB File Size Limit Test ---")
    # Generate 10MB + 1024 bytes dummy file
    oversized_bytes = b"0" * (10 * 1024 * 1024 + 1024)

    response = client.post(
        "/api/drafts/upload",
        files={"file": ("too_large.docx", oversized_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"brand_id": BRAND_A_ID, "title": "Oversized DOCX"}
    )
    assert response.status_code == 413, f"Expected 413 Payload Too Large, got {response.status_code}"
    detail = response.json().get("detail", "")
    assert "10MB" in detail, f"Expected 10MB in error detail, got: {detail}"
    print(f"PASS: Oversized file (>10MB) rejected with HTTP 413: '{detail}'")


def test_unextractable_image_notice():
    print("\n--- Unextractable Image Notice Test ---")
    import sys, os, zipfile
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from document_parser import extract_docx, parse_document

    # Verify that unextractable images set images_unextractable=True and reason="Image could not be extracted — check manually"
    # Never a fake pass
    valid_docx = create_docx_bytes(["Sample creative text for testing unextractable media."])
    buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(valid_docx), "r") as zin:
        with zipfile.ZipFile(buf, "w") as zout:
            for item in zin.infolist():
                zout.writestr(item, zin.read(item.filename))
            zout.writestr("word/media/corrupt_image.png", b"NOT_A_VALID_IMAGE_BYTES_XYZ")
    corrupt_docx = buf.getvalue()

    parsed = extract_docx(corrupt_docx, [])
    assert parsed["images_unextractable"] is True, "Expected images_unextractable to be True for corrupt image"
    assert parsed["unextractable_reason"] in ("Image could not be extracted — check manually", "Could not sample — human decision"), f"Unexpected reason: {parsed['unextractable_reason']}"
    print(f"PASS: Corrupted/unextractable image flags '{parsed['unextractable_reason']}', never a fake pass.")


def run_all_tests():
    print("=" * 70)
    print("STARTING COMPREHENSIVE DOCUMENT GOVERNANCE SELF-TEST SUITE")
    print("=" * 70)
    test_brand_a_docx()
    test_clean_brand_a_docx()
    test_brand_a_pdf_with_image()
    test_brand_b_docx()
    test_scanned_pdf_honest_limit()
    test_pdf_page_order_and_citation()
    test_file_size_limit_10mb()
    test_unextractable_image_notice()
    print("\n" + "=" * 70)
    print("ALL DOCUMENT GOVERNANCE TESTS PASSED (8/8)")
    print("=" * 70)

if __name__ == "__main__":
    run_all_tests()

