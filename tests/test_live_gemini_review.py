import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from dotenv import load_dotenv
env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
load_dotenv(env_file, override=True)

# Test with active Google model gemini-3.5-flash-lite
os.environ["LLM_MODEL"] = "gemini-3.5-flash-lite"

from llm_review import run_grounded_llm_review

def main():
    print("=" * 60)
    print("TESTING LIVE GEMINI REVIEW WITH ACTIVE MODEL (gemini-3.5-flash-lite)")
    print("=" * 60)

    active_vault_items = [
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "F-12",
            "kind": "fact",
            "status": "active",
            "title": "Festive Cookware Promotional Price",
            "text": "Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026."
        },
        {
            "brand_id": "00000000-0000-0000-0000-000000000001",
            "item_id": "R-04",
            "kind": "rule",
            "status": "active",
            "title": "Superlatives & Ranking Claims Require Approved Evidence",
            "text": "Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records."
        }
    ]

    demo_text = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"

    res = run_grounded_llm_review(
        body_text=demo_text,
        alt_text=None,
        image_url=None,
        active_vault_items=active_vault_items,
        timeout_seconds=15.0
    )

    print(f"STATUS: {res.get('status')}")
    print(f"AVAILABLE: {res.get('available')}")
    print(f"REASON: {res.get('reason')}")
    print(f"MODEL: {res.get('model')}")
    print(f"RETRIEVED CITATIONS: {res.get('retrieved_citation_ids')}")
    findings = res.get("findings", [])
    print(f"GROUNDED FINDINGS COUNT: {len(findings)}")
    for f in findings:
        print(f" - [{f.get('citation_id')}] ({f.get('lane')} | {f.get('severity')}): {f.get('explanation')}")

    print("=" * 60)

if __name__ == "__main__":
    main()
