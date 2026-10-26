import os
import sys
import json
from typing import Dict, Any

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from llm_review import extract_and_parse_json, parse_gemini_response

def run_unit_tests():
    print("=" * 60)
    print("RUNNING EXTENDED GEMINI PARSER UNIT TESTS (2a - 2f)")
    print("=" * 60)

    retrieved_items = [
        {"item_id": "F-12", "kind": "fact", "status": "active"},
        {"item_id": "R-04", "kind": "rule", "status": "active"},
    ]

    # --------------------------------------------------------------------------
    # 2a. Pure JSON response
    # --------------------------------------------------------------------------
    raw_2a = json.dumps([
        {
            "lane": "contradiction",
            "severity": "high",
            "citation_id": "F-12",
            "explanation": "Price contradicts fact F-12",
            "suggested_fix": "Rs. 1,299"
        },
        {
            "lane": "contradiction",
            "severity": "medium",
            "citation_id": "UNCITED-99", # Must be dropped by citation validator
            "explanation": "Fake rule",
            "suggested_fix": None
        }
    ])
    findings_2a = parse_gemini_response(raw_2a, retrieved_items)
    assert len(findings_2a) == 1, f"Expected 1 finding, got {len(findings_2a)}"
    assert findings_2a[0]["citation_id"] == "F-12"
    assert not any(f["citation_id"] == "UNCITED-99" for f in findings_2a)
    print("PASS: 2a - Pure JSON response parsed (F-12 kept, UNCITED-99 dropped)")

    # --------------------------------------------------------------------------
    # 2b. JSON wrapped in ```json code fence
    # --------------------------------------------------------------------------
    raw_2b = f"""```json
[
  {{
    "lane": "evidence_needed",
    "severity": "high",
    "citation_id": "R-04",
    "explanation": "Superlative claim requires evidence",
    "suggested_fix": "trusted"
  }}
]
```"""
    findings_2b = parse_gemini_response(raw_2b, retrieved_items)
    assert len(findings_2b) == 1
    assert findings_2b[0]["citation_id"] == "R-04"
    print("PASS: 2b - Fenced JSON parsed cleanly")

    # --------------------------------------------------------------------------
    # 2c. Prose before + JSON + prose after
    # --------------------------------------------------------------------------
    raw_2c = f"""Here is my compliance review based on the retrieved items:
[
  {{
    "lane": "contradiction",
    "severity": "high",
    "citation_id": "F-12",
    "explanation": "Price contradicts fact F-12",
    "suggested_fix": "Rs. 1,299"
  }}
]
I hope this brand governance review was helpful!"""
    findings_2c = parse_gemini_response(raw_2c, retrieved_items)
    assert len(findings_2c) == 1
    assert findings_2c[0]["citation_id"] == "F-12"
    print("PASS: 2c - Prose + JSON + prose parsed cleanly")

    # --------------------------------------------------------------------------
    # 2d. {"issues": [...]} shape with flexible field names (citation / description / fix)
    # --------------------------------------------------------------------------
    raw_2d = json.dumps({
        "issues": [
            {
                "category": "evidence_needed",
                "level": "high",
                "citation": "R-04", # citation instead of citation_id
                "description": "Claim requires evidence record", # description instead of explanation
                "fix": "trusted" # fix instead of suggested_fix
            }
        ]
    })
    findings_2d = parse_gemini_response(raw_2d, retrieved_items)
    assert len(findings_2d) == 1, f"Expected 1 finding, got {len(findings_2d)}"
    assert findings_2d[0]["citation_id"] == "R-04"
    assert findings_2d[0]["suggested_fix"] == "trusted"
    assert "Claim requires evidence record" in findings_2d[0]["explanation"]
    print("PASS: 2d - {'issues': [...]} shape with flexible field names parsed and mapped")

    # --------------------------------------------------------------------------
    # 2e. Multiple content parts concatenated
    # --------------------------------------------------------------------------
    part1 = '[\n  {\n    "lane": "evidence_needed",\n    "severity": "high",\n'
    part2 = '    "citation_id": "R-04",\n    "explanation": "Claim requires evidence",\n'
    part3 = '    "suggested_fix": "trusted"\n  }\n]'
    concatenated = part1 + part2 + part3
    findings_2e = parse_gemini_response(concatenated, retrieved_items)
    assert len(findings_2e) == 1
    assert findings_2e[0]["citation_id"] == "R-04"
    print("PASS: 2e - Multiple parts concatenated and parsed cleanly")

    # --------------------------------------------------------------------------
    # 2f. Empty candidates / truly invalid text
    # --------------------------------------------------------------------------
    raw_2f = "No JSON here at all, just plain conversational text."
    try:
        parse_gemini_response(raw_2f, retrieved_items)
        assert False, "Expected ValueError on text with no JSON"
    except ValueError:
        print("PASS: 2f - Empty / invalid JSON raises ValueError triggering labeled 'invalid JSON response'")

    print("=" * 60)
    print("ALL 6 PARSER UNIT TESTS (2a - 2f) PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_unit_tests()
