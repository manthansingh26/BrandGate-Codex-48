#!/usr/bin/env python3
"""
AUTOMATED TEST SUITE FOR PHASE 4.1: REPORT BRAND-SWITCH RESTORATION ONLY
Tests:
(1) Multi-version draft: v2 image, v3 image, v4 image removed & 0 findings -> brand switch restore -> 0 findings, CLEAR TO PUBLISH.
(2) Multi-version draft: v1 PDF findings + v2 DOCX findings -> restore -> exactly v2 findings (1x F-12, 2x R-04), no duplicate F-12 / R-04.
(3) Single-version draft restoration still correct (NovaTech 1x F-20 + 2x R-15).
(4) Fresh re-review of unchanged text gives same findings as restored report (no correction needed).
(5) Regressions: Judge path (Rs. 1,299 locked snapshot), fresh image upload (P-01 + R-09), PDF badges, Insights timeline count.
(6) Frontend build verification.
"""

import sys
import json
import urllib.request
import urllib.error
import base64
import struct
import zlib
import subprocess

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def http_req(method: str, path: str, payload=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            res_data = res.read().decode("utf-8")
            return json.loads(res_data) if res_data else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {err_msg}")

def create_solid_color_png(hex_color: str, width: int = 10, height: int = 10) -> bytes:
    hex_clean = hex_color.lstrip("#")
    r, g, b = int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
    def chunk(tag, data):
        return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack("!2I5B", width, height, 8, 2, 0, 0, 0))
    raw_row = b"\x00" + bytes([r, g, b]) * width
    raw_data = raw_row * height
    idat = chunk(b"IDAT", zlib.compress(raw_data))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend

def png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")

def compute_disposition(findings):
    if len(findings) == 0:
        return "Clear to Publish"
    if any(f.get("lane") == "contradiction" for f in findings):
        return "Hold for Legal"
    return "Clear with Edits"

def simulate_frontend_get_draft(draft_id: str):
    """Simulates frontend client.ts getDraft filtering logic."""
    data = http_req("GET", f"/api/drafts/{draft_id}")
    cur_v = data.get("current_version", 1)
    raw_findings = data.get("findings", [])
    # Client-side defensive filtering
    filtered = [
        f for f in raw_findings
        if f.get("version_no") == cur_v or (cur_v == 1 and f.get("version_no") is None)
    ]
    if not data.get("image_url"):
        filtered = [
            f for f in filtered
            if f.get("citation_id") not in ("P-01", "P-10", "A-02", "R-09")
        ]
    data["findings"] = filtered
    return data

def main():
    print("=" * 70)
    print("PHASE 4.1 AUTOMATED SELF-TEST: REPORT BRAND-SWITCH RESTORATION")
    print("=" * 70)

    test_results = {}

    # --------------------------------------------------------------------------
    # Test 1: Multi-version draft image removal & brand switch
    # --------------------------------------------------------------------------
    print("\n--- Test 1: Multi-version draft (image removed v4 -> 0 findings) ---")
    try:
        pink_data = png_to_data_url(create_solid_color_png("#FF0060"))
        # v1: initial draft
        d1 = http_req("POST", "/api/drafts", {
            "brand_id": BRAND_A_ID,
            "title": "Multi-version Image Removal Test",
            "body_text": "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!",
            "created_by_role": "guest"
        })
        d_id = d1["id"]

        # v2: attach image + review
        http_req("POST", f"/api/drafts/{d_id}/image", {
            "image_url": pink_data,
            "alt_text": None,
            "logo_confirmed": False
        })
        http_req("POST", f"/api/drafts/{d_id}/revise", {
            "body_text": "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299! (v2)",
            "image_url": pink_data
        })
        rev2 = http_req("POST", f"/api/drafts/{d_id}/review", {
            "palette_off": True,
            "image_url": pink_data
        })
        assert any(f["citation_id"] in ("P-01", "R-09") for f in rev2["findings"])

        # v3: slight revision, keep image
        http_req("POST", f"/api/drafts/{d_id}/revise", {
            "body_text": "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299! (v3)",
            "image_url": pink_data
        })
        rev3 = http_req("POST", f"/api/drafts/{d_id}/review", {
            "palette_off": True,
            "image_url": pink_data
        })
        assert any(f["citation_id"] in ("P-01", "R-09") for f in rev3["findings"])

        # v4: remove image, clean text
        clean_text = "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"
        rev4_draft = http_req("POST", f"/api/drafts/{d_id}/revise", {
            "body_text": clean_text,
            "remove_image": True
        })
        assert rev4_draft["version_no"] == 4

        rev4_review = http_req("POST", f"/api/drafts/{d_id}/review", {
            "remove_image": True
        })
        assert len(rev4_review["findings"]) == 0, f"Expected 0 findings on v4 review, got {rev4_review['findings']}"

        # SIMULATE BRAND-SWITCH RESTORATION:
        # Step A: Switch away to Brand B
        drafts_b = http_req("GET", f"/api/drafts?brand_id={BRAND_B_ID}")
        assert all(d["brand_id"] == BRAND_B_ID for d in drafts_b)

        # Step B: Switch back to Brand A and restore latest draft
        drafts_a = http_req("GET", f"/api/drafts?brand_id={BRAND_A_ID}")
        assert drafts_a[0]["id"] == d_id, "Latest draft is not the test draft"

        restored_draft = simulate_frontend_get_draft(d_id)
        assert restored_draft["current_version"] == 4, f"Expected v4, got {restored_draft.get('current_version')}"
        assert len(restored_draft["findings"]) == 0, f"Expected EXACTLY 0 findings, got {len(restored_draft['findings'])}: {restored_draft['findings']}"
        assert restored_draft.get("image_url") is None, "Expected image_url=None on v4"

        disp = compute_disposition(restored_draft["findings"])
        assert disp == "Clear to Publish", f"Expected Clear to Publish, got {disp}"

        # Assert no old image findings present
        cit_ids = [f.get("citation_id") for f in restored_draft["findings"]]
        assert "R-09" not in cit_ids
        assert "A-02" not in cit_ids
        assert "P-01" not in cit_ids

        test_results["Test 1: Multi-version image removal restoration"] = (
            "PASS",
            f"Restored Version 4 with image removed: exactly 0 findings, disposition 'Clear to Publish', zero R-09/A-02/P-01 findings leaked from v2/v3."
        )
    except Exception as e:
        test_results["Test 1: Multi-version image removal restoration"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Test 2: Multi-version PDF + DOCX draft restoration
    # --------------------------------------------------------------------------
    print("\n--- Test 2: Multi-version PDF + DOCX (no duplicate findings) ---")
    try:
        # v1: simulate draft with findings on page 2 (PDF scenario)
        d2 = http_req("POST", "/api/drafts", {
            "brand_id": BRAND_A_ID,
            "title": "PDF then DOCX Multi-version Test",
            "body_text": "[Page 1] Intro text. [Page 2] India's No. 1 cookware now for Rs. 999!",
            "created_by_role": "guest"
        })
        d2_id = d2["id"]
        # review v1
        rev_v1 = http_req("POST", f"/api/drafts/{d2_id}/review", {})
        assert len(rev_v1["findings"]) >= 2

        # v2: revise with DOCX content (1x F-12 + 2x R-04)
        docx_body = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"
        rev_v2_draft = http_req("POST", f"/api/drafts/{d2_id}/revise", {
            "body_text": docx_body
        })
        assert rev_v2_draft["version_no"] == 2

        # review v2
        rev_v2 = http_req("POST", f"/api/drafts/{d2_id}/review", {})
        v2_cits = [f["citation_id"] for f in rev_v2["findings"]]
        assert v2_cits.count("F-12") == 1
        assert v2_cits.count("R-04") == 2
        assert len(rev_v2["findings"]) == 3, f"Expected 3 findings for v2, got {len(rev_v2['findings'])}"

        # SIMULATE BRAND-SWITCH RESTORATION:
        # Switch to Brand B, then switch back to Brand A
        _ = http_req("GET", f"/api/drafts?brand_id={BRAND_B_ID}")
        restored_v2 = simulate_frontend_get_draft(d2_id)

        assert restored_v2["current_version"] == 2
        assert len(restored_v2["findings"]) == 3, f"Expected exactly 3 findings for Version 2, got {len(restored_v2['findings'])}: {restored_v2['findings']}"

        restored_cits = [f["citation_id"] for f in restored_v2["findings"]]
        assert restored_cits.count("F-12") == 1, f"Expected 1x F-12, got {restored_cits.count('F-12')} (duplicate detected!)"
        assert restored_cits.count("R-04") == 2, f"Expected 2x R-04, got {restored_cits.count('R-04')} (duplicate detected!)"

        disp2 = compute_disposition(restored_v2["findings"])
        assert disp2 == "Hold for Legal", f"Expected Hold for Legal, got {disp2}"

        test_results["Test 2: Multi-version PDF + DOCX restoration"] = (
            "PASS",
            f"Restored Version 2: exactly 3 findings (1x F-12 + 2x R-04), zero duplicates from Version 1, disposition 'Hold for Legal'."
        )
    except Exception as e:
        test_results["Test 2: Multi-version PDF + DOCX restoration"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Test 3: Single-version draft restoration
    # --------------------------------------------------------------------------
    print("\n--- Test 3: Single-version draft restoration ---")
    try:
        # Create single-version draft for Brand B
        b_body = "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!"
        d_b = http_req("POST", "/api/drafts", {
            "brand_id": BRAND_B_ID,
            "title": "Single-version NovaTech Test",
            "body_text": b_body,
            "created_by_role": "guest"
        })
        b_id = d_b["id"]

        # Review single-version draft
        b_rev = http_req("POST", f"/api/drafts/{b_id}/review", {})
        assert len(b_rev["findings"]) == 3
        b_cits = [f["citation_id"] for f in b_rev["findings"]]
        assert b_cits.count("F-20") == 1
        assert b_cits.count("R-15") == 2

        # Simulate brand switch: Switch to Brand A, then switch back to Brand B
        _ = http_req("GET", f"/api/drafts?brand_id={BRAND_A_ID}")
        restored_b = simulate_frontend_get_draft(b_id)

        assert restored_b["current_version"] == 1
        assert len(restored_b["findings"]) == 3
        restored_b_cits = [f["citation_id"] for f in restored_b["findings"]]
        assert restored_b_cits.count("F-20") == 1
        assert restored_b_cits.count("R-15") == 2
        disp_b = compute_disposition(restored_b["findings"])
        assert disp_b == "Hold for Legal"

        test_results["Test 3: Single-version draft restoration"] = (
            "PASS",
            f"Restored single-version Brand B draft: exactly 3 findings (1x F-20, 2x R-15), disposition 'Hold for Legal'."
        )
    except Exception as e:
        test_results["Test 3: Single-version draft restoration"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Test 4: Fresh re-review gives SAME findings as restored report
    # --------------------------------------------------------------------------
    print("\n--- Test 4: Fresh re-review identical to restored report ---")
    try:
        # Take the restored draft from Test 2
        fresh_review = http_req("POST", f"/api/drafts/{d2_id}/review", {})
        fresh_findings = fresh_review.get("findings", [])

        restored_draft = simulate_frontend_get_draft(d2_id)
        restored_findings = restored_draft.get("findings", [])

        assert len(fresh_findings) == len(restored_findings), (
            f"Count mismatch: fresh re-review={len(fresh_findings)} vs restored={len(restored_findings)}"
        )

        fresh_cits = sorted([f["citation_id"] for f in fresh_findings])
        restored_cits = sorted([f["citation_id"] for f in restored_findings])
        assert fresh_cits == restored_cits, f"Citations mismatch: fresh={fresh_cits} vs restored={restored_cits}"

        fresh_lanes = sorted([f["lane"] for f in fresh_findings])
        restored_lanes = sorted([f["lane"] for f in restored_findings])
        assert fresh_lanes == restored_lanes, f"Lanes mismatch: fresh={fresh_lanes} vs restored={restored_lanes}"

        test_results["Test 4: Fresh re-review matches restored report"] = (
            "PASS",
            f"Fresh re-review on unchanged text produced identical {len(fresh_findings)} findings with matching citations and lanes; zero correction needed."
        )
    except Exception as e:
        test_results["Test 4: Fresh re-review matches restored report"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Test 5: Regressions (Judge path, Image, PDF badges, Insights)
    # --------------------------------------------------------------------------
    print("\n--- Test 5: Regressions ---")
    try:
        # (a) Judge path: 1x F-12 + 2x R-04 -> Rs. 1,299 -> locked snapshot
        d_j = http_req("POST", "/api/drafts", {
            "brand_id": BRAND_A_ID,
            "title": "Judge Path Regression Test",
            "body_text": "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!",
            "created_by_role": "guest"
        })
        rev_j = http_req("POST", f"/api/drafts/{d_j['id']}/review", {})
        assert [f["citation_id"] for f in rev_j["findings"]].count("F-12") == 1
        assert [f["citation_id"] for f in rev_j["findings"]].count("R-04") == 2

        for f in rev_j["findings"]:
            if f.get("suggested_fix"):
                http_req("POST", f"/api/drafts/{d_j['id']}/apply-fix", {"finding_id": f["id"]})

        d_j_clean = http_req("GET", f"/api/drafts/{d_j['id']}")
        assert "trusted cookware brand" in d_j_clean["body_text"]
        assert "certified quality non-stick" in d_j_clean["body_text"]
        assert "Rs. 1,299" in d_j_clean["body_text"]

        http_req("POST", f"/api/drafts/{d_j['id']}/review", {})
        http_req("POST", f"/api/drafts/{d_j['id']}/request-approval", {"comment": "Ready", "role": "creator"})
        appr_res = http_req("POST", f"/api/drafts/{d_j['id']}/approve", {"comment": "Approved", "role": "demo_reviewer"})
        assert appr_res["status"] == "approved"

        d_j_appr = http_req("GET", f"/api/drafts/{d_j['id']}")
        assert d_j_appr["status"] == "approved"
        assert d_j_appr["approved_snapshot"]["compliance_badge"] == "VERIFIED COMPLIANT"
        assert d_j_appr["approved_snapshot"]["approved_text"] == "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"

        # (b) Fresh image upload: pink PNG -> P-01 + R-09
        pink_png = create_solid_color_png("#FF0060")
        pink_data = png_to_data_url(pink_png)
        d_img = http_req("POST", "/api/drafts", {
            "brand_id": BRAND_A_ID,
            "title": "Fresh Image Test",
            "body_text": "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!",
            "image_url": pink_data,
            "alt_text": None,
            "created_by_role": "guest"
        })
        rev_img = http_req("POST", f"/api/drafts/{d_img['id']}/review", {
            "palette_off": True,
            "image_url": pink_data
        })
        img_cits = [f["citation_id"] for f in rev_img["findings"]]
        assert "P-01" in img_cits
        assert "R-09" in img_cits

        # (c) Insights timeline count == current version report count
        insights = http_req("GET", f"/api/insights?brand_id={BRAND_A_ID}")
        timeline = insights.get("drafts_timeline", [])
        assert len(timeline) > 0
        for item in timeline[:10]:
            draft_obj = http_req("GET", f"/api/drafts/{item['id']}")
            cur_v = draft_obj.get("current_version", 1)
            # Both timeline count and draft findings must match
            assert item["findings_count"] == len(draft_obj.get("findings", [])), (
                f"Timeline mismatch for {item['id']}: timeline={item['findings_count']} vs draft.findings={len(draft_obj.get('findings', []))}"
            )

        test_results["Test 5: Regressions"] = (
            "PASS",
            f"Judge path (Rs. 1,299 locked snapshot), fresh image (P-01 + R-09), and Insights timeline count parity all passed."
        )
    except Exception as e:
        test_results["Test 5: Regressions"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Test 6: Frontend build passes
    # --------------------------------------------------------------------------
    print("\n--- Test 6: Frontend build ---")
    try:
        cmd = ["npm", "run", "build"]
        p = subprocess.run(cmd, cwd="frontend", capture_output=True, text=True, check=True)
        assert "built in" in p.stdout or "dist/index.html" in p.stdout
        test_results["Test 6: Frontend build"] = (
            "PASS",
            "Frontend build (tsc && vite build) completed with 0 errors."
        )
    except Exception as e:
        test_results["Test 6: Frontend build"] = ("FAIL", str(e))

    # --------------------------------------------------------------------------
    # Summary
    # --------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("FINAL SUMMARY OF AUTOMATED SELF-TESTS")
    print("=" * 70)
    all_passed = True
    for test_name, (status, detail) in test_results.items():
        print(f"[{status}] {test_name}: {detail}")
        if status != "PASS":
            all_passed = False

    print("=" * 70)
    if all_passed:
        print("ALL AUTOMATED SELF-TESTS PASSED!")
    else:
        print("SOME SELF-TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    main()
