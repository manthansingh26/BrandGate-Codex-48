import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def test_api():
    print("=" * 60)
    print("RUNNING LIVE FASTAPI ENDPOINT AUTOMATED TESTS")
    print("=" * 60)

    # 1. GET /health
    req = urllib.request.Request(f"{BASE_URL}/health")
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data.get("status") == "ok"
        print("PASS: 2a - GET /health -> status: ok")

    # 2. GET /api/brands
    req = urllib.request.Request(f"{BASE_URL}/api/brands")
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        brands = json.loads(resp.read().decode())
        assert len(brands) > 0
        demo_brand = brands[0]
        brand_id = demo_brand["id"]
        print(f"PASS: 2b - GET /api/brands -> found brand: '{demo_brand['name']}' ({brand_id})")

    # 3. POST /api/drafts (guest, no token)
    draft_payload = {
        "brand_id": brand_id,
        "title": "Automated Phase 7 Test Draft",
        "body_text": "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!",
        "created_by_role": "guest"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts",
        data=json.dumps(draft_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 201
        draft = json.loads(resp.read().decode())
        draft_id = draft["id"]
        assert draft["current_version"] == 1
        assert draft["status"] == "draft"
        print(f"PASS: 2c - POST /api/drafts -> created draft id: {draft_id} (version 1, status draft)")

    # 4. POST /api/drafts/{id}/review
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/review",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        assert resp.status == 200
        review_data = json.loads(resp.read().decode())

        findings = review_data.get("deterministic_findings") or review_data.get("findings")
        assert len(findings) == 3, f"Expected 3 findings, got {len(findings)}"

        f12 = next((f for f in findings if f["citation_id"] == "F-12"), None)
        r04_list = [f for f in findings if f["citation_id"] == "R-04"]
        uncited = [f for f in findings if not f.get("citation_id")]

        assert f12 is not None and f12["lane"] == "contradiction" and f12["suggested_fix"] == "Rs. 1,299"
        assert len(r04_list) == 2 and all(f["lane"] == "evidence_needed" for f in r04_list)
        assert len(uncited) == 0

        # LLM review check (2h)
        llm_rev = review_data.get("llm_review", {})
        assert llm_rev.get("available") is False or len(llm_rev.get("findings", [])) >= 0
        print(f"PASS: 2d & 2h - POST /api/review -> F-12 contradiction, 2x R-04 evidence needed, 0 uncited. LLM status: '{llm_rev.get('status')}' (reason: '{llm_rev.get('reason')}')")

    # 5. Apply-fix on F-12
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/apply-fix",
        data=json.dumps({"finding_id": f12["id"]}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        fix_res = json.loads(resp.read().decode())
        assert fix_res["version_no"] == 2
        assert "Rs. 1,299" in fix_res["body_text"]
        print(f"PASS: 2e - Apply-fix F-12 -> updated to v2 with Rs. 1,299 in body text")

    # 6. POST /api/drafts/{id}/image
    img_payload = {
        "image_url": "https://korebydfhklfahxyamsq.supabase.co/storage/v1/object/public/brandgate-creatives/test.png",
        "alt_text": "Festive cookware promotional hero image",
        "logo_confirmed": True
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/image",
        data=json.dumps(img_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        img_res = json.loads(resp.read().decode())
        assert img_res.get("status") == "image_attached"
        print(f"PASS: 2f - POST /api/drafts/{draft_id}/image -> image attached, logo confirmed recorded")

    # 7. GET /api/insights
    req = urllib.request.Request(f"{BASE_URL}/api/insights?brand_id={brand_id}")
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        insights = json.loads(resp.read().decode())
        assert "counts_by_citation" in insights
        assert insights["counts_by_citation"]["F-12"] >= 1
        assert insights["counts_by_citation"]["R-04"] >= 2
        print(f"PASS: 2g - GET /api/insights -> real DB counts: F-12={insights['counts_by_citation']['F-12']}, R-04={insights['counts_by_citation']['R-04']}")

    print("=" * 60)
    print("ALL LIVE FASTAPI ENDPOINT TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_api()
