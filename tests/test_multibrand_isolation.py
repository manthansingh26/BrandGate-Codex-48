import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def request_json(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    if data is not None and "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def test_multibrand_isolation():
    print("=" * 70)
    print("RUNNING MULTI-BRAND WORKSPACE ISOLATION & SCOPING AUTOMATED TESTS")
    print("=" * 70)

    # 1. Brands API: both demo brands returned, each has id, name, created_by
    status, brands = request_json(f"{BASE_URL}/api/brands")
    assert status == 200, f"Expected 200, got {status}"
    assert len(brands) >= 2, f"Expected at least 2 demo brands, got {len(brands)}"
    brand_a = next((b for b in brands if b["id"] == BRAND_A_ID), None)
    brand_b = next((b for b in brands if b["id"] == BRAND_B_ID), None)
    assert brand_a is not None, "Brand A (Demo Brand Seeded) not found"
    assert brand_b is not None, "Brand B (NovaTech Audio Demo) not found"
    for b in [brand_a, brand_b]:
        assert "id" in b and b["id"], f"Brand missing 'id': {b}"
        assert "name" in b and b["name"], f"Brand missing 'name': {b}"
        assert "created_by" in b and b["created_by"], f"Brand missing 'created_by': {b}"
    print(f"PASS: 1 - Brands data model verified: Brand A ({brand_a['name']}), Brand B ({brand_b['name']}) with created_by='{brand_a['created_by']}'")

    # 2. Test (b) Scoped Vault: Brand B returns ONLY Brand B items, 0 Brand A items
    status, vault_b = request_json(f"{BASE_URL}/api/brands/{BRAND_B_ID}/vault")
    assert status == 200
    all_b_items = vault_b.get("fact", []) + vault_b.get("rule", []) + vault_b.get("terminology", []) + vault_b.get("palette", [])
    b_item_ids = {item["item_id"] for item in all_b_items}
    print(f"DEBUG: Brand B vault item_ids: {b_item_ids}")

    # Brand B must contain its seeded items
    assert "F-20" in b_item_ids, "F-20 missing from Brand B vault"
    assert "R-15" in b_item_ids, "R-15 missing from Brand B vault"
    assert "T-10" in b_item_ids, "T-10 missing from Brand B vault"
    assert "P-10" in b_item_ids, "P-10 missing from Brand B vault"
    assert "P-11" in b_item_ids, "P-11 missing from Brand B vault"

    # Brand B MUST NEVER contain Brand A items
    brand_a_items = {"F-12", "R-04", "A-02", "R-09", "P-01", "P-02", "P-03", "P-04", "T-01", "T-02", "T-03", "T-04"}
    leaked_into_b = b_item_ids.intersection(brand_a_items)
    assert len(leaked_into_b) == 0, f"Brand A items leaked into Brand B vault: {leaked_into_b}"

    # Every item in Brand B vault carries brand_id == BRAND_B_ID
    for item in all_b_items:
        assert item.get("brand_id") == BRAND_B_ID, f"Vault item {item.get('item_id')} has wrong brand_id: {item.get('brand_id')}"
    print("PASS: 2 (b) Scoped Vault verified: Brand B returns only Brand B items, zero Brand A items leaked, all carry brand_id.")

    # 3. Snapshot initial Brand A state before any Brand B operations
    status, initial_a_drafts = request_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_A_ID}")
    assert status == 200
    initial_a_draft_ids = [d["id"] for d in initial_a_drafts]

    status, initial_a_insights = request_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    assert status == 200
    assert initial_a_insights.get("brand_id") == BRAND_A_ID

    status, vault_a = request_json(f"{BASE_URL}/api/brands/{BRAND_A_ID}/vault")
    assert status == 200
    all_a_items = vault_a.get("fact", []) + vault_a.get("rule", []) + vault_a.get("terminology", []) + vault_a.get("palette", [])
    a_item_ids = {item["item_id"] for item in all_a_items}
    assert "F-12" in a_item_ids
    assert "F-20" not in a_item_ids, "Brand B item F-20 found in Brand A vault!"

    # 4. Test (a) Cross-brand leak: create a draft in Brand B
    b_draft_payload = {
        "brand_id": BRAND_B_ID,
        "title": "NovaTech ANC 500 Leak Isolation Creative",
        "body_text": "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!",
        "created_by_role": "guest"
    }
    status, created_b_draft = request_json(f"{BASE_URL}/api/drafts", method="POST", data=b_draft_payload)
    assert status == 201
    b_draft_id = created_b_draft["id"]
    assert created_b_draft["brand_id"] == BRAND_B_ID
    print(f"Created Brand B draft: {b_draft_id} for brand_id {BRAND_B_ID}")

    # Review Brand B draft (generates findings for Brand B)
    status, b_review = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/review", method="POST", data={})
    assert status == 200
    assert b_review.get("brand_id") == BRAND_B_ID
    b_findings = b_review.get("deterministic_findings", [])
    assert len(b_findings) > 0, "Expected findings for Brand B test creative"
    for f in b_findings:
        assert f.get("brand_id") == BRAND_B_ID, f"Finding missing brand_id: {f}"

    # Assert Brand A drafts are completely unchanged
    status, current_a_drafts = request_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_A_ID}")
    assert status == 200
    current_a_draft_ids = [d["id"] for d in current_a_drafts]
    assert current_a_draft_ids == initial_a_draft_ids, "Brand A drafts changed after creating draft in Brand B!"
    assert b_draft_id not in current_a_draft_ids, f"Brand B draft {b_draft_id} leaked into Brand A drafts list!"

    # Assert Brand A vault is unchanged
    status, current_vault_a = request_json(f"{BASE_URL}/api/brands/{BRAND_A_ID}/vault")
    assert status == 200
    current_a_items = current_vault_a.get("fact", []) + current_vault_a.get("rule", []) + current_vault_a.get("terminology", []) + current_vault_a.get("palette", [])
    current_a_item_ids = {item["item_id"] for item in current_a_items}
    assert current_a_item_ids == a_item_ids, "Brand A vault items changed after Brand B operations!"

    # Assert Brand A insights are completely unchanged
    status, current_a_insights = request_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    assert status == 200
    assert current_a_insights["total_findings"] == initial_a_insights["total_findings"], \
        f"Brand A findings count changed from {initial_a_insights['total_findings']} to {current_a_insights['total_findings']}!"
    assert "F-20" not in current_a_insights.get("counts_by_citation", {}), "Brand B citation F-20 found in Brand A insights!"
    print("PASS: 3 (a) Cross-brand leak verified: Brand B draft created & reviewed, Brand A drafts/vault/insights strictly unchanged.")

    # 5. Test (c) Scoped Approval: resolve Brand B findings and approve Brand B draft
    # Apply fix for F-20 (price Rs. 3,499 -> Rs. 4,999)
    f20_finding = next((f for f in b_findings if f.get("citation_id") == "F-20"), None)
    assert f20_finding is not None, "F-20 finding expected on Brand B draft"
    status, fix_res = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/apply-fix", method="POST", data={"finding_id": f20_finding["id"]})
    assert status == 200
    assert fix_res.get("brand_id") == BRAND_B_ID

    # Revise remaining claims so draft has 0 open findings
    clean_text = "Experience NovaTech ANC 500 with certified audio and verified battery performance — now for just Rs. 4,999!"
    status, rev_res = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/revise", method="POST", data={"body_text": clean_text})
    assert status == 200
    assert rev_res.get("brand_id") == BRAND_B_ID

    # Re-review Brand B draft (now 0 open findings)
    status, b_review_clean = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/review", method="POST", data={})
    assert status == 200
    assert len(b_review_clean.get("deterministic_findings", [])) == 0, f"Expected 0 findings after fix, got: {b_review_clean.get('deterministic_findings')}"

    # Request approval for Brand B draft
    status, req_app = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/request-approval", method="POST", data={"comment": "Ready for approval"})
    assert status == 200

    # Approve Brand B draft
    status, app_res = request_json(f"{BASE_URL}/api/drafts/{b_draft_id}/approve", method="POST", data={"comment": "Approved NovaTech creative"})
    assert status == 200
    assert app_res.get("status") == "approved"
    assert app_res.get("brand_id") == BRAND_B_ID
    assert app_res.get("snapshot", {}).get("locked") is True
    assert app_res.get("snapshot", {}).get("brand_id") == BRAND_B_ID
    print(f"Approved Brand B draft {b_draft_id} with locked snapshot.")

    # Assert Brand A state is strictly unchanged after Brand B approval
    status, after_app_a_drafts = request_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_A_ID}")
    assert status == 200
    after_app_a_ids = [d["id"] for d in after_app_a_drafts]
    assert after_app_a_ids == initial_a_draft_ids, "Brand A drafts list altered by Brand B approval!"

    for draft_a in after_app_a_drafts:
        # None of Brand A's drafts should have their status changed by Brand B's approval
        assert draft_a["id"] != b_draft_id, "Brand B draft leaked into Brand A drafts!"
        assert draft_a["brand_id"] == BRAND_A_ID, f"Draft in Brand A list has foreign brand_id: {draft_a['brand_id']}"

    status, after_app_a_insights = request_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    assert status == 200
    assert after_app_a_insights["total_findings"] == initial_a_insights["total_findings"], \
        "Brand A insights total changed after Brand B approval!"
    print("PASS: 4 (c) Scoped Approval verified: Brand B draft approved, Brand A state/drafts/insights remain strictly unchanged.")

    # 6. Negative security check: Guest cannot read non-demo brands or write outside demo scope
    random_uuid = "11111111-2222-3333-4444-555555555555"
    try:
        request_json(f"{BASE_URL}/api/brands/{random_uuid}/vault")
        assert False, "Guest should not be able to read non-demo brand vault!"
    except urllib.error.HTTPError as exc:
        assert exc.code in (403, 404), f"Expected 403 or 404, got {exc.code}"
        print(f"PASS: 5 (d) Security check: Guest access to non-demo brand blocked ({exc.code}).")

    print("=" * 70)
    print("ALL MULTI-BRAND WORKSPACE ISOLATION TESTS PASSED (100% GREEN)")
    print("=" * 70)

if __name__ == "__main__":
    test_multibrand_isolation()
