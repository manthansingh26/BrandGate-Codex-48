import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def run_judge_path():
    print("=" * 60)
    print("RUNNING FULL JUDGE PATH SELF-TEST")
    print("=" * 60)

    # Step 1: Demo draft initialized
    demo_draft_id = "local-draft-judge-20261101"
    print(f"1. Initialized guest demo draft with ID: {demo_draft_id}")

    # Step 2: Review Draft
    review_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{demo_draft_id}/review",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(review_req, timeout=30) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        review_data = json.loads(resp.read().decode())
    
    canonical_id = review_data["id"]
    findings = review_data["findings"]
    print(f"2. Review Draft succeeded -> canonical UUID: {canonical_id}")
    print(f"   Total findings returned: {len(findings)}")

    f12 = [f for f in findings if f.get("citation_id") == "F-12"]
    r04 = [f for f in findings if f.get("citation_id") == "R-04"]
    uncited = [f for f in findings if not f.get("citation_id")]

    assert len(f12) == 1, f"Expected 1x F-12, got {len(f12)}"
    assert f12[0]["lane"] == "contradiction", f"F-12 lane should be contradiction, got {f12[0]['lane']}"
    assert len(r04) == 2, f"Expected 2x R-04, got {len(r04)}"
    assert all(f["lane"] == "evidence_needed" for f in r04), "R-04 lane should be evidence_needed"
    assert len(uncited) == 0, f"Expected 0 uncited, got {len(uncited)}"

    print("   VERIFIED: 1x F-12 Contradiction + 2x R-04 Evidence Needed + 0 uncited findings.")

    # Step 3: Apply Fixes
    # Apply F-12 fix (Rs. 999 -> Rs. 1,299)
    fix_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{demo_draft_id}/apply-fix",
        data=json.dumps({"finding_id": f12[0]["id"]}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(fix_req, timeout=10) as resp:
        assert resp.status == 200
        fix_res = json.loads(resp.read().decode())
        current_text = fix_res["body_text"]
    print(f"3a. Applied F-12 fix -> body text: {repr(current_text)}")

    # Apply R-04 fixes
    for idx, r in enumerate(r04):
        fix_req = urllib.request.Request(
            f"{BASE_URL}/api/drafts/{demo_draft_id}/apply-fix",
            data=json.dumps({"finding_id": r["id"]}).encode(),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(fix_req, timeout=10) as resp:
            assert resp.status == 200
            fix_res = json.loads(resp.read().decode())
            current_text = fix_res["body_text"]
        print(f"3b.{idx+1} Applied R-04 fix -> body text: {repr(current_text)}")

    assert "Rs. 1,299" in current_text, f"Expected 'Rs. 1,299' in text, got: {current_text}"
    assert "No. 1" not in current_text, f"Expected no 'No. 1' in text, got: {current_text}"
    print(f"   VERIFIED: text contains 'Rs. 1,299' and zero occurrences of 'No. 1'.")

    # Step 4: Re-review after fixes
    rereview_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{demo_draft_id}/review",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(rereview_req, timeout=30) as resp:
        assert resp.status == 200
        rereview_data = json.loads(resp.read().decode())
        remaining = rereview_data["findings"]
        contradictions = [f for f in remaining if f["lane"] in ("contradiction", "evidence_needed")]
        assert len(contradictions) == 0, f"Expected 0 open blocker findings, got {len(contradictions)}"
    print(f"4. Re-review after fixes -> 0 open blocker findings remain.")

    # Step 5: Request Approval (as guest / creator)
    req_app_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{demo_draft_id}/request-approval",
        data=json.dumps({"comment": "Ready for publication review"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_app_req, timeout=10) as resp:
        assert resp.status == 200
        req_res = json.loads(resp.read().decode())
        assert req_res["status"] == "pending_approval"
    print(f"5. Request Approval -> status: pending_approval")

    # Step 6: Approve as Reviewer (guest demo reviewer)
    app_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{demo_draft_id}/approve",
        data=json.dumps({"comment": "Approved for Diwali festive campaign"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(app_req, timeout=10) as resp:
        assert resp.status == 200
        app_res = json.loads(resp.read().decode())
        assert app_res["status"] == "approved"
        snapshot = app_res["snapshot"]
        assert snapshot["locked"] is True
        assert snapshot["compliance_badge"] == "VERIFIED COMPLIANT"
        assert snapshot["approver_role"] == "demo_reviewer"
        assert "Rs. 1,299" in snapshot["approved_text"]
        assert "No. 1" not in snapshot["approved_text"]
    print(f"6. Approve Draft -> status: approved, locked snapshot verified!")
    print(f"   Badge: {snapshot['compliance_badge']}, Approver: {snapshot['approver_role']}")

    # Step 7: GET /api/drafts/{id}
    get_req = urllib.request.Request(f"{BASE_URL}/api/drafts/{demo_draft_id}")
    with urllib.request.urlopen(get_req, timeout=10) as resp:
        assert resp.status == 200
        get_res = json.loads(resp.read().decode())
        assert get_res["status"] == "approved"
        assert get_res.get("approved_snapshot", {}).get("locked") is True
    print(f"7. GET /api/drafts/{demo_draft_id} -> verified locked approved snapshot in draft payload.")

    print("=" * 60)
    print("FULL JUDGE PATH SELF-TEST COMPLETED: ALL ASSERTIONS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_judge_path()
