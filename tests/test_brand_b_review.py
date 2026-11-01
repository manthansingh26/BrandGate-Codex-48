"""
Test verification of Brand B Review Findings:
Asserts that a Brand B draft with unapproved price and claims produces:
1x F-20 Contradiction + 2x R-15 Evidence Needed + 0 Brand A leaks.
"""

import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def run_test():
    print("=" * 60)
    print("RUNNING BRAND B REVIEW VERIFICATION TEST")
    print("=" * 60)

    # Original locked Brand B demo text:
    # 1. Price: Rs. 3,499 (contradicts F-20 promotional price Rs. 4,999) -> 1x F-20
    # 2. 80-hour and battery life (triggers 2x R-15 lab benchmark claims) -> 2x R-15
    # 3. world's best audio
    body_text = "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!"

    draft_payload = {
        "brand_id": BRAND_B_ID,
        "title": "NovaTech ANC 500 Launch Review Test",
        "body_text": body_text,
        "created_by_role": "guest"
    }

    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts",
        data=json.dumps(draft_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        draft = json.loads(resp.read().decode())
    
    draft_id = draft["id"]
    print(f"Created Brand B draft: {draft_id}")

    rev_req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/review",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(rev_req, timeout=15) as resp:
        rev_data = json.loads(resp.read().decode())

    findings = rev_data.get("findings", [])
    print(f"Total findings for Brand B draft: {len(findings)}")
    for f in findings:
        print(f" - [{f.get('lane')}] {f.get('citation_id')}: {f.get('explanation')}")

    f20 = [f for f in findings if f.get("citation_id") == "F-20"]
    r15 = [f for f in findings if f.get("citation_id") == "R-15"]
    f12 = [f for f in findings if f.get("citation_id") == "F-12"]
    r04 = [f for f in findings if f.get("citation_id") == "R-04"]

    assert len(f20) == 1, f"Expected 1x F-20, got {len(f20)}"
    assert f20[0]["lane"] == "contradiction", f"Expected F-20 lane=contradiction, got {f20[0]['lane']}"
    assert len(r15) == 2, f"Expected 2x R-15, got {len(r15)}"
    assert all(f["lane"] == "evidence_needed" for f in r15), "Expected R-15 lane=evidence_needed"
    assert len(f12) == 0, f"Brand A F-12 leaked into Brand B: {f12}"
    assert len(r04) == 0, f"Brand A R-04 leaked into Brand B: {r04}"

    print("=" * 60)
    print("PASS: Brand B review gives exactly 1x F-20 + 2x R-15 (0 leaked Brand A citations).")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
