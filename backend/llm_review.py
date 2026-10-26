import os
import json
import re
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

from retrieval import retrieve_relevant_vault_items
from review_engine import validate_citations

logger = logging.getLogger("brandgate.llm_review")

# ------------------------------------------------------------------------------
# Robust JSON Block Extractor
# ------------------------------------------------------------------------------
def extract_and_parse_json(raw_text: str) -> Any:
    """
    Robustly extracts and parses JSON from raw LLM output:
    1. Strips markdown code fences (```json and ```) and trims whitespace.
    2. Directly attempts json.loads on cleaned text.
    3. If surrounding prose exists, extracts the first balanced JSON array [ ... ]
       or object { ... } and parses it.
    4. Handles both array format and {"findings": [...]} object wrapper.
    5. Raises ValueError only if no valid JSON block can be parsed.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Empty LLM response text")

    text = raw_text.strip()

    # 1. Clean markdown code fences (e.g. ```json ... ``` or ``` ... ```)
    cleaned = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE).strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for k in ["findings", "issues", "violations", "results", "data", "checks"]:
                if k in data and isinstance(data[k], list):
                    return data[k]
            return [data]
    except Exception:
        pass

    # 2. Balanced bracket parser to extract first valid [ ... ] block amidst prose
    start_bracket = text.find('[')
    if start_bracket != -1:
        bracket_depth = 0
        in_string = False
        escape = False
        for i in range(start_bracket, len(text)):
            char = text[i]
            if in_string:
                if escape:
                    escape = False
                elif char == '\\':
                    escape = True
                elif char == '"':
                    in_string = False
            else:
                if char == '"':
                    in_string = True
                elif char == '[':
                    bracket_depth += 1
                elif char == ']':
                    bracket_depth -= 1
                    if bracket_depth == 0:
                        candidate = text[start_bracket : i + 1]
                        try:
                            data = json.loads(candidate)
                            if isinstance(data, list):
                                return data
                        except Exception:
                            pass
                        break

    # 3. Balanced brace parser to extract first valid { ... } block (e.g. {"issues": [...]})
    start_brace = text.find('{')
    if start_brace != -1:
        brace_depth = 0
        in_string = False
        escape = False
        for i in range(start_brace, len(text)):
            char = text[i]
            if in_string:
                if escape:
                    escape = False
                elif char == '\\':
                    escape = True
                elif char == '"':
                    in_string = False
            else:
                if char == '"':
                    in_string = True
                elif char == '{':
                    brace_depth += 1
                elif char == '}':
                    brace_depth -= 1
                    if brace_depth == 0:
                        candidate = text[start_brace : i + 1]
                        try:
                            data = json.loads(candidate)
                            if isinstance(data, dict):
                                for k in ["findings", "issues", "violations", "results", "data", "checks"]:
                                    if k in data and isinstance(data[k], list):
                                        return data[k]
                                return [data]
                        except Exception:
                            pass
                        break

    raise ValueError("No valid JSON array or object could be extracted from response")


# ------------------------------------------------------------------------------
# Gemini Response Parser & Validator (Exported for automated unit testing)
# ------------------------------------------------------------------------------
def parse_gemini_response(
    raw_content: str,
    retrieved_items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Parses Google-format Gemini output using robust JSON extraction,
    normalizes flexible field names (citation_id / citation / rule_id,
    explanation / description / message, suggested_fix / fix),
    formats findings with AI suggestion indicator, and enforces
    the mandatory Phase 3 Citation Validator.
    """
    parsed_findings = extract_and_parse_json(raw_content)

    formatted_findings = []
    for f in parsed_findings:
        if not isinstance(f, dict):
            continue

        # Flexible citation ID extraction (handles citation_id, vault_item, citation, rule_id, id)
        raw_cid = (
            f.get("citation_id")
            or f.get("vault_item")
            or f.get("citation")
            or f.get("rule_id")
            or f.get("id")
            or ""
        )
        cid = str(raw_cid).strip()

        # Flexible explanation extraction (handles explanation, issue, description, message, reason)
        explanation = (
            f.get("explanation")
            or f.get("issue")
            or f.get("description")
            or f.get("message")
            or f.get("reason")
            or ""
        )

        # Flexible suggested fix extraction (handles suggested_fix, recommendation, fix, suggestion)
        suggested_fix = (
            f.get("suggested_fix")
            or f.get("recommendation")
            or f.get("fix")
            or f.get("suggestion")
            or f.get("replacement")
        )

        # Flexible lane mapping
        raw_lane = f.get("lane") or f.get("category") or f.get("type")
        if not raw_lane:
            if "contradict" in explanation.lower() or "price" in explanation.lower() or cid == "F-12":
                clean_lane = "contradiction"
            elif "evidence" in explanation.lower() or "superlative" in explanation.lower() or cid == "R-04":
                clean_lane = "evidence_needed"
            else:
                clean_lane = "human_decision"
        else:
            clean_lane = str(raw_lane).lower().strip()
            if clean_lane not in ["contradiction", "evidence_needed", "human_decision"]:
                clean_lane = "human_decision"


        # Severity
        raw_sev = f.get("severity") or f.get("level") or "medium"
        clean_sev = str(raw_sev).lower().strip()
        if clean_sev not in ["high", "medium", "low"]:
            clean_sev = "medium"

        formatted_findings.append({
            "lane": clean_lane,
            "severity": clean_sev,
            "citation_id": cid,
            "explanation": f"[AI suggestion — grounded in {cid}] {explanation}",
            "suggested_fix": suggested_fix
        })

    # Pass through mandatory Citation Validator (Drops any finding with no active retrieved citation)
    return validate_citations(formatted_findings, retrieved_items)




# ------------------------------------------------------------------------------
# Google Gemini Provider Call
# ------------------------------------------------------------------------------
def call_gemini_review(
    system_prompt: str,
    user_prompt: str,
    gemini_key: str,
    model: str,
    retrieved_items: List[Dict[str, Any]],
    timeout_seconds: float = 15.0
) -> Dict[str, Any]:
    """
    Calls Google Gemini generateContent endpoint:
    https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    Auth via x-goog-api-key header only (never in URL or logs).
    """
    retrieved_ids = [item.get("item_id") for item in retrieved_items]
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    # Google Gemini format request body
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": combined_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json"
        }
    }



    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": gemini_key
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if not candidates:
                return {
                    "available": False,
                    "status": "LLM review unavailable",
                    "reason": "empty response",
                    "provider": "gemini",
                    "model": model,
                    "retrieved_citation_ids": retrieved_ids,
                    "findings": []
                }

            # Concatenate ALL text parts from candidates[0].content.parts, not just the first part
            parts = candidates[0].get("content", {}).get("parts", [])
            raw_text = "".join(
                p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p
            )

            # DIAGNOSTIC STEP 1: Log exact candidate facts, first 500 chars, and exact json.loads error
            finish_reason = candidates[0].get("finishReason", "UNKNOWN")
            print(f"[GEMINI_DEBUG] candidates present? Yes | parts count: {len(parts)} | total length: {len(raw_text)} | finish_reason: {finish_reason}")
            print(f"[GEMINI_DEBUG] first 500 chars of raw output:\n{repr(raw_text[:500])}")

            # Try raw json.loads to capture exact exception
            try:
                json.loads(raw_text)
                print("[GEMINI_DEBUG] raw json.loads: SUCCESS")
            except Exception as direct_json_err:
                print(f"[GEMINI_DEBUG] exact json.loads error: {type(direct_json_err).__name__}: {direct_json_err}")

            try:
                validated_findings = parse_gemini_response(raw_text, retrieved_items)
                return {
                    "available": True,
                    "status": "LLM review complete",
                    "reason": None,
                    "provider": "gemini",
                    "model": model,
                    "retrieved_citation_ids": retrieved_ids,
                    "findings": validated_findings
                }
            except Exception as parse_err:
                print(f"[GEMINI_PARSE_FAILED] Error: {parse_err} | First 200 chars: {repr(raw_text[:200])}")
                return {
                    "available": False,
                    "status": "LLM review unavailable",
                    "reason": "invalid JSON response",
                    "provider": "gemini",
                    "model": model,
                    "retrieved_citation_ids": retrieved_ids,
                    "findings": []
                }



    except urllib.error.HTTPError as http_err:
        err_body = ""
        try:
            err_body = http_err.read().decode("utf-8", errors="replace")
        except Exception:
            pass

        # Parse Google JSON error details if present
        google_code = http_err.code
        google_status = "HTTP_ERROR"
        google_msg = str(http_err)
        try:
            parsed_err = json.loads(err_body).get("error", {})
            google_status = parsed_err.get("status", google_status)
            google_msg = parsed_err.get("message", google_msg)
        except Exception:
            pass

        # Safe diagnostic log: status and message only (never logs key or full prompt)
        print(f"[GOOGLE_HTTP_ERROR] code: {google_code} | status: '{google_status}' | message: '{google_msg[:200]}'")
        logger.warning(f"[GOOGLE_HTTP_ERROR] code: {google_code} | status: '{google_status}' | message: '{google_msg[:200]}'")

        # If model is unavailable (503 demand spike or 404 deprecated), automatically fallback to active gemini-3.5-flash-lite
        if http_err.code in [404, 503] and model != "gemini-3.5-flash-lite":
            print(f"[GEMINI_FALLBACK] {http_err.code} on {model}. Retrying with active model 'gemini-3.5-flash-lite'...")
            return call_gemini_review(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                gemini_key=gemini_key,
                model="gemini-3.5-flash-lite",
                retrieved_items=retrieved_items,
                timeout_seconds=timeout_seconds
            )

        if http_err.code == 404:
            reason_msg = "model not found"
        elif http_err.code in [400, 401, 403]:
            reason_msg = "invalid key" if "API_KEY" in google_status or "API_KEY" in google_msg else f"invalid request ({google_status})"
        elif http_err.code == 429:
            reason_msg = "rate limit"
        elif http_err.code == 503:
            reason_msg = "model high demand"
        else:
            reason_msg = f"provider HTTP error {http_err.code}"


        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": reason_msg,
            "provider": "gemini",
            "model": model,
            "retrieved_citation_ids": retrieved_ids,
            "findings": []
        }

    except urllib.error.URLError as url_err:
        reason_msg = "timeout" if "timed out" in str(url_err).lower() else "connection error"
        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": reason_msg,
            "provider": "gemini",
            "model": model,
            "retrieved_citation_ids": retrieved_ids,
            "findings": []
        }
    except Exception as exc:
        reason_msg = "timeout" if "timed out" in str(exc).lower() else "provider error"
        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": reason_msg,
            "provider": "gemini",
            "model": model,
            "retrieved_citation_ids": retrieved_ids,
            "findings": []
        }


# ------------------------------------------------------------------------------
# NVIDIA NIM Provider Call (Preserved as Fallback)
# ------------------------------------------------------------------------------
def call_nvidia_review(
    system_prompt: str,
    user_prompt: str,
    nvidia_key: str,
    nvidia_url: str,
    model: str,
    retrieved_items: List[Dict[str, Any]],
    timeout_seconds: float = 15.0
) -> Dict[str, Any]:
    retrieved_ids = [item.get("item_id") for item in retrieved_items]
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 1000
    }

    req = urllib.request.Request(
        nvidia_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {nvidia_key}"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            raw_content = res_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            json_match = re.search(r'\[.*\]', raw_content, re.DOTALL)
            if not json_match:
                return {
                    "available": False,
                    "status": "LLM review unavailable",
                    "reason": "invalid JSON response",
                    "provider": "nvidia",
                    "model": model,
                    "retrieved_citation_ids": retrieved_ids,
                    "findings": []
                }

            parsed_findings = json.loads(json_match.group(0))
            formatted_findings = [
                {
                    "lane": f.get("lane", "human_decision"),
                    "severity": f.get("severity", "medium"),
                    "citation_id": f.get("citation_id", "").strip(),
                    "explanation": f"[AI suggestion — grounded in {f.get('citation_id', '').strip()}] {f.get('explanation', '')}",
                    "suggested_fix": f.get("suggested_fix")
                }
                for f in parsed_findings
            ]
            validated_llm_findings = validate_citations(formatted_findings, retrieved_items)
            return {
                "available": True,
                "status": "LLM review complete",
                "reason": None,
                "provider": "nvidia",
                "model": model,
                "retrieved_citation_ids": retrieved_ids,
                "findings": validated_llm_findings
            }
    except Exception as exc:
        reason_msg = "timeout" if "timed out" in str(exc).lower() else "provider error"
        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": reason_msg,
            "provider": "nvidia",
            "model": model,
            "retrieved_citation_ids": retrieved_ids,
            "findings": []
        }


# ------------------------------------------------------------------------------
# Grounded LLM Review Engine (Provider Switch)
# ------------------------------------------------------------------------------
def run_grounded_llm_review(
    body_text: str,
    alt_text: Optional[str],
    image_url: Optional[str],
    active_vault_items: List[Dict[str, Any]],
    brand_id: Optional[str] = None,
    timeout_seconds: float = 60.0,
    force_fallback: bool = False
) -> Dict[str, Any]:

    """
    Executes grounded LLM brand governance review with provider switching:
    1. If LLM_PROVIDER=gemini and GEMINI_API_KEY is set: calls Google Gemini.
    2. Else if LLM_API_KEY is set: calls NVIDIA NIM fallback.
    3. Else returns "LLM review unavailable (key not set)".
    """
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    gemini_key = os.environ.get("GEMINI_API_KEY")
    nvidia_key = os.environ.get("LLM_API_KEY")
    nvidia_url = os.environ.get("LLM_API_URL")

    # Step 1: Targeted retrieval (Never dumps the whole vault)
    retrieved_items = retrieve_relevant_vault_items(
        draft_text=body_text,
        active_vault_items=active_vault_items,
        brand_id=brand_id,
        limit=5,
        force_fallback=force_fallback
    )

    if not retrieved_items:
        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": "no relevant vault items retrieved",
            "provider": provider or "none",
            "model": os.environ.get("LLM_MODEL", "gemini-2.5-flash"),
            "retrieved_citation_ids": [],
            "findings": []
        }

    retrieved_ids = [item.get("item_id") for item in retrieved_items]

    # Step 2: Determine provider and check keys
    use_gemini = (provider == "gemini") or (not provider and gemini_key)

    if use_gemini:
        # Dynamically read model from env at CALL time
        env_model = os.environ.get("LLM_MODEL", "").strip()
        # If gemini-2.5-flash is set, auto-fallback to active gemini-3.5-flash-lite (as 2.5 is deprecated by Google)
        if not env_model or env_model in ["gemini-2.5-flash", "gemini-2.5-flash-lite"]:
            model = "gemini-3.5-flash-lite"
        else:
            model = env_model

        if not gemini_key:
            return {
                "available": False,
                "status": "LLM review unavailable",
                "reason": "key not set",
                "provider": "gemini",
                "model": model,
                "retrieved_citation_ids": retrieved_ids,
                "findings": []
            }

    elif nvidia_key and nvidia_url:
        model = os.environ.get("LLM_MODEL", "meta/llama-3.1-8b-instruct")
    else:
        # No key set for any supported provider
        return {
            "available": False,
            "status": "LLM review unavailable",
            "reason": "key not set",
            "provider": provider or "none",
            "model": os.environ.get("LLM_MODEL", "gemini-2.5-flash"),
            "retrieved_citation_ids": retrieved_ids,
            "findings": []
        }

    # Step 3: Construct retrieval-only prompt (No invented rules, exact IDs only)
    retrieved_context_lines = [
        f"- ID: {item.get('item_id')} | Kind: {item.get('kind')} | Title: {item.get('title')} | Text: {item.get('text')}"
        for item in retrieved_items
    ]
    retrieved_context = "\n".join(retrieved_context_lines)

    system_prompt = (
        "You are BrandGate's AI Brand Governance Auditor. "
        "Review the draft content ONLY against the explicitly retrieved brand vault items provided below.\n\n"
        "STRICT MANDATORY OUTPUT RULES:\n"
        "1. Return ONLY valid JSON. No markdown, no code fence, no explanation before or after the JSON, no extra text.\n"
        "2. Every finding MUST cite an exact retrieved item ID from the provided list. Never invent a guideline.\n"
        "3. Superlatives without evidence records must be categorized as 'evidence_needed' citing R-04, NEVER as false.\n"
        "4. Price contradictions must be categorized as 'contradiction' citing F-12.\n"
        "5. If no rules are violated, return an empty JSON array: [].\n\n"
        "EXACT REQUIRED JSON SCHEMA:\n"
        "[\n"
        "  {\n"
        '    "lane": "contradiction",\n'
        '    "severity": "high",\n'
        '    "citation_id": "F-12",\n'
        '    "explanation": "Price contradicts approved fact F-12.",\n'
        '    "suggested_fix": "Rs. 1,299"\n'
        "  }\n"
        "]"
    )


    user_prompt = (
        f"RETRIEVED BRAND VAULT ITEMS:\n{retrieved_context}\n\n"
        f"DRAFT TO REVIEW:\n"
        f"Body Text: {body_text}\n"
        f"Alt Text: {alt_text or 'None'}\n"
        f"Image URL: {image_url or 'None'}\n\n"
        "Return the JSON array of findings:"
    )

    # Step 4: Dispatch to chosen provider
    if use_gemini:
        return call_gemini_review(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            gemini_key=gemini_key,
            model=model,
            retrieved_items=retrieved_items,
            timeout_seconds=timeout_seconds
        )
    else:
        return call_nvidia_review(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            nvidia_key=nvidia_key,
            nvidia_url=nvidia_url,
            model=model,
            retrieved_items=retrieved_items,
            timeout_seconds=timeout_seconds
        )
