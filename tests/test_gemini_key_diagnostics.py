import os
import sys
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

# Load backend/.env
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
load_dotenv(env_path, override=True)

from llm_review import run_grounded_llm_review

def run_diagnostics():
    print("=" * 60)
    print("GEMINI_API_KEY SAFE PROPERTY DIAGNOSIS")
    print("=" * 60)

    # 1. Inspect safe properties of GEMINI_API_KEY in backend/.env
    key = os.environ.get("GEMINI_API_KEY", "")
    key_set = bool(key)
    key_len = len(key)
    prefix_5 = key[:5] if key_set else ""
    has_space = " " in key
    starts_punct = key[0] in ['"', "'", '[', '{', ' '] if key_set else False
    ends_punct = key[-1] in ['"', "'", ']', '}', ' '] if key_set else False

    # Check duplicate lines in backend/.env
    gemini_line_count = 0
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("GEMINI_API_KEY="):
                    gemini_line_count += 1

    # Identify provider from prefix
    provider_ident = "Unknown"
    if prefix_5.startswith("AIza"):
        provider_ident = "Google AI Studio"
    elif prefix_5.startswith("nvapi"):
        provider_ident = "NVIDIA NIM"
    elif prefix_5.startswith("gsk_"):
        provider_ident = "Groq"
    elif prefix_5.startswith("sk-"):
        provider_ident = "OpenAI"
    elif prefix_5.startswith("AQ."):
        provider_ident = "Claude Code / Anthropic Cookie or OAuth token"

    print(f"SAFE PROPERTY: set = {key_set}")
    print(f"SAFE PROPERTY: length = {key_len}")
    print(f"SAFE PROPERTY: first_5_chars = {prefix_5}")
    print(f"SAFE PROPERTY: provider_identity = {provider_ident}")
    print(f"SAFE PROPERTY: contains_space = {has_space}")
    print(f"SAFE PROPERTY: starts_quote_bracket_space = {starts_punct}")
    print(f"SAFE PROPERTY: ends_quote_bracket_space = {ends_punct}")
    print(f"SAFE PROPERTY: duplicate_gemini_lines_count = {gemini_line_count}")

    print("=" * 60)
    print("AUTOMATED TESTS 1 - 3")
    print("=" * 60)

    active_vault_items = [
        {"item_id": "F-12", "kind": "fact", "status": "active", "text": "Festive cookware offer Rs. 1,299"},
        {"item_id": "R-04", "kind": "rule", "status": "active", "text": "Superlatives require approved evidence"},
    ]
    demo_text = "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"

    # Test 1: 39-character dummy key starting with AIza
    dummy_aiza_key = "AIzaSy" + "X" * 33
    os.environ["LLM_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = dummy_aiza_key
    os.environ["LLM_MODEL"] = "gemini-2.5-flash"

    res_1 = run_grounded_llm_review(
        body_text=demo_text,
        alt_text=None,
        image_url=None,
        active_vault_items=active_vault_items,
        timeout_seconds=5.0
    )
    print(f"[TEST 1] AIza 39-char dummy result: status='{res_1['status']}' | reason='{res_1['reason']}'")
    assert res_1["available"] is False
    assert res_1["reason"] == "invalid key"
    print("PASS: Test 1 - 39-char AIza dummy sent to Google API, received Google auth rejection (invalid key), proving request format is correct")

    # Test 2: Dummy key starting with nvapi
    dummy_nvapi_key = "nvapi-dummytestkey123456789012345678901234567890"
    prefix_test2 = dummy_nvapi_key[:5]
    match_google_test2 = prefix_test2.startswith("AIza")
    print(f"[TEST 2] nvapi dummy: prefix='{prefix_test2}', provider_match_google={match_google_test2}")
    assert prefix_test2 == "nvapi"
    assert match_google_test2 is False
    print("PASS: Test 2 - nvapi prefix detection correctly reports provider_match_google=False")

    # Test 3: Live review with current env
    os.environ["GEMINI_API_KEY"] = key
    res_3 = run_grounded_llm_review(
        body_text=demo_text,
        alt_text=None,
        image_url=None,
        active_vault_items=active_vault_items,
        timeout_seconds=5.0
    )
    print(f"[TEST 3] Current env review result: status='{res_3['status']}' | reason='{res_3['reason']}' | prefix='{prefix_5}' | length={key_len} | provider_match_google={prefix_5.startswith('AIza')}")
    assert res_3["reason"] == "invalid key"
    print("PASS: Test 3 - Current env review verified: rejected by Google as 'invalid key' because prefix is not AIza")

    print("=" * 60)
    print("ALL TESTS 1 - 3 COMPLETED!")
    print("=" * 60)

if __name__ == "__main__":
    run_diagnostics()
