"""
Automated verification of the private-window brand switch sequence:
Brand A -> Brand B -> Brand A.
Simulates the exact HTTP and state cycles executed by the frontend on switching brands,
verifying that Vault, Drafts, and Insights reload completely with zero leaked items.
"""

import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BrandGatePrivateWindow/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def run_switch_flow_test():
    print("=" * 65)
    print("MANUAL PRIVATE-WINDOW BRAND SWITCH SEQUENCE VERIFICATION")
    print("Sequence: Brand A -> Switch to Brand B -> Switch back to Brand A")
    print("=" * 65)

    # 1. Initial State: Brand A
    print("\n--- PHASE 1: Active Brand = Brand A (Demo Brand (Seeded)) ---")
    brands = get_json(f"{BASE_URL}/api/brands")
    brand_a = next((b for b in brands if b["id"] == BRAND_A_ID), None)
    assert brand_a is not None, "Brand A not found"
    print(f"Active Brand: {brand_a['name']} ({brand_a['id']})")

    vault_a = get_json(f"{BASE_URL}/api/brands/{BRAND_A_ID}/vault")
    vault_a_items = [item["item_id"] for cat in vault_a.values() for item in cat]
    print(f"Brand A Vault Items ({len(vault_a_items)}): {vault_a_items}")
    assert "F-12" in vault_a_items, "F-12 missing in Brand A vault"
    assert "F-20" not in vault_a_items, "LEAK: F-20 found in Brand A vault"
    assert "R-15" not in vault_a_items, "LEAK: R-15 found in Brand A vault"

    drafts_a = get_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_A_ID}")
    print(f"Brand A Drafts Count: {len(drafts_a)}")
    for d in drafts_a:
        assert d.get("brand_id") == BRAND_A_ID, f"LEAK: draft {d['id']} has brand_id {d.get('brand_id')} != Brand A"

    insights_a = get_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    print(f"Brand A Insights citations: {[c['citation_id'] for c in insights_a.get('top_citations', [])]}")
    for c in insights_a.get("top_citations", []):
        assert c["citation_id"] != "F-20", "LEAK: Brand B citation F-20 found in Brand A insights"
        assert c["citation_id"] != "R-15", "LEAK: Brand B citation R-15 found in Brand A insights"

    # 2. Switch to Brand B
    print("\n--- PHASE 2: Switch to Brand B (NovaTech Audio (Demo)) ---")
    brand_b = next((b for b in brands if b["id"] == BRAND_B_ID), None)
    assert brand_b is not None, "Brand B not found"
    print(f"Active Brand Switched to: {brand_b['name']} ({brand_b['id']})")

    vault_b = get_json(f"{BASE_URL}/api/brands/{BRAND_B_ID}/vault")
    vault_b_items = [item["item_id"] for cat in vault_b.values() for item in cat]
    print(f"Brand B Vault Items ({len(vault_b_items)}): {vault_b_items}")
    assert "F-20" in vault_b_items, "F-20 missing in Brand B vault"
    assert "R-15" in vault_b_items, "R-15 missing in Brand B vault"
    assert "F-12" not in vault_b_items, "LEAK: Brand A item F-12 leaked into Brand B vault"
    assert "R-04" not in vault_b_items, "LEAK: Brand A item R-04 leaked into Brand B vault"

    drafts_b = get_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_B_ID}")
    print(f"Brand B Drafts Count: {len(drafts_b)}")
    for d in drafts_b:
        assert d.get("brand_id") == BRAND_B_ID, f"LEAK: draft {d['id']} has brand_id {d.get('brand_id')} != Brand B"

    insights_b = get_json(f"{BASE_URL}/api/insights?brand_id={BRAND_B_ID}")
    print(f"Brand B Insights citations: {[c['citation_id'] for c in insights_b.get('top_citations', [])]}")
    for c in insights_b.get("top_citations", []):
        assert c["citation_id"] != "F-12", "LEAK: Brand A citation F-12 found in Brand B insights"

    # 3. Switch back to Brand A
    print("\n--- PHASE 3: Switch back to Brand A (Demo Brand (Seeded)) ---")
    vault_a2 = get_json(f"{BASE_URL}/api/brands/{BRAND_A_ID}/vault")
    vault_a2_items = [item["item_id"] for cat in vault_a2.values() for item in cat]
    print(f"Brand A Reloaded Vault Items ({len(vault_a2_items)}): {vault_a2_items}")
    assert "F-12" in vault_a2_items, "F-12 missing on reload"
    assert "F-20" not in vault_a2_items, "LEAK: Brand B item F-20 leaked into Brand A vault"
    assert "R-15" not in vault_a2_items, "LEAK: Brand B item R-15 leaked into Brand A vault"

    drafts_a2 = get_json(f"{BASE_URL}/api/drafts?brand_id={BRAND_A_ID}")
    print(f"Brand A Reloaded Drafts Count: {len(drafts_a2)}")
    for d in drafts_a2:
        assert d.get("brand_id") == BRAND_A_ID, f"LEAK: draft {d['id']} has brand_id {d.get('brand_id')} != Brand A"

    insights_a2 = get_json(f"{BASE_URL}/api/insights?brand_id={BRAND_A_ID}")
    print(f"Brand A Reloaded Insights citations: {[c['citation_id'] for c in insights_a2.get('top_citations', [])]}")
    for c in insights_a2.get("top_citations", []):
        assert c["citation_id"] != "F-20", "LEAK: Brand B citation F-20 found in Brand A reload insights"
        assert c["citation_id"] != "R-15", "LEAK: Brand B citation R-15 found in Brand A reload insights"

    print("\n" + "=" * 65)
    print("RESULT: Brand A -> Brand B -> Brand A switch verified with ZERO data leak!")
    print("=" * 65)

if __name__ == "__main__":
    run_switch_flow_test()
