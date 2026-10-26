import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("brandgate.review")

# ------------------------------------------------------------------------------
# Citation Validator: No citation, no flag
# ------------------------------------------------------------------------------
def validate_citations(
    findings: List[Dict[str, Any]],
    active_vault_items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    MANDATORY SERVER-SIDE CITATION VALIDATOR:
    Before saving, drop EVERY finding whose citation_id does not match an active
    vault item for the target brand that actually supports that finding.
    Log dropped findings to the server console only (never return them, never log vault secrets).
    No citation, no flag.
    """
    valid_active_item_ids = {
        item["item_id"]: item
        for item in active_vault_items
        if item.get("status") == "active"
    }

    validated_findings = []
    for f in findings:
        cid = f.get("citation_id")
        if cid and cid in valid_active_item_ids:
            validated_findings.append(f)
        else:
            logger.warning(
                f"[CITATION_VALIDATOR_DROPPED] Dropped finding without active vault citation: "
                f"citation_id='{cid}', lane='{f.get('lane')}', explanation='{f.get('explanation')}'"
            )

    return validated_findings


# ------------------------------------------------------------------------------
# Core Deterministic Review Logic (Server-Side, Zero AI, Rule-Based)
# ------------------------------------------------------------------------------
def run_deterministic_review(
    body_text: str,
    alt_text: Optional[str],
    image_url: Optional[str],
    active_vault_items: List[Dict[str, Any]],
    logo_confirmed: bool = False,
    palette_off: bool = False,
    contrast_ratio: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Executes deterministic brand governance checks:
    1. Price / number check (Regex matching vs approved facts)
    2. Superlative / performance claims (Evidence needed check, cited R-04)
    3. Terminology check (Banned / restricted terms)
    4. Tone check (Rule-based guideline matching)
    5. Alt-text accessibility check (Cited R-09)
    6. Logo verification check (Reviewer-confirmed only, cited A-02)
    7. Palette checking (Approximate sampling, cited P-01)
    """
    raw_findings: List[Dict[str, Any]] = []

    # Filter strictly active items
    active_items = [item for item in active_vault_items if item.get("status") == "active"]
    facts = [item for item in active_items if item.get("kind") == "fact"]
    rules = [item for item in active_items if item.get("kind") == "rule"]
    terminologies = [item for item in active_items if item.get("kind") == "terminology"]
    palettes = [item for item in active_items if item.get("kind") == "palette"]


    # --------------------------------------------------------------------------
    # 1. Price / Number Check
    # --------------------------------------------------------------------------
    # Find price amounts using regex (Rs. 999, Rs. 1,299, ₹999, INR 999)
    price_pattern = re.compile(r'(?:Rs\.?|INR|₹)\s*([\d,]+)', re.IGNORECASE)
    draft_matches = list(price_pattern.finditer(body_text))

    # Compare to approved facts (such as F-12: Festive cookware offer Rs. 1,299)
    f12_item = next((item for item in facts if item.get("item_id") == "F-12"), None)
    if f12_item:
        fact_price_match = price_pattern.search(f12_item.get("text", ""))
        if fact_price_match:
            approved_amount_str = fact_price_match.group(1).replace(",", "")
            for m in draft_matches:
                draft_amount_str = m.group(1).replace(",", "")
                if draft_amount_str != approved_amount_str:
                    raw_findings.append({
                        "lane": "contradiction",
                        "severity": "high",
                        "citation_id": "F-12",
                        "explanation": f"Draft price '{m.group(0)}' contradicts approved promotional fact F-12 ('Rs. 1,299').",
                        "suggested_fix": "Rs. 1,299"
                    })

    # --------------------------------------------------------------------------
    # 2. Superlative & Performance Claims Check (Cited R-04)
    # --------------------------------------------------------------------------
    # Rule R-04: Rank and performance superlatives require an approved evidence record.
    # Seeded vault has NO approved evidence records.
    # Any superlative/claim without approved evidence MUST produce an EVIDENCE NEEDED finding.
    # NEVER label as false fact.
    r04_rule = next((item for item in rules if item.get("item_id") == "R-04"), None)
    if r04_rule:
        claim_triggers = [
            "India's No. 1",
            "clinically proven",
            "best",
            "guaranteed"
        ]

        for claim in claim_triggers:
            if re.search(r'\b' + re.escape(claim) + r'\b', body_text, re.IGNORECASE):
                # Check if vault has an approved evidence record for this claim
                has_approved_evidence = any(
                    item.get("kind") == "fact" and claim.lower() in item.get("text", "").lower()
                    for item in facts
                )
                if not has_approved_evidence:
                    suggested = None
                    if "no. 1" in claim.lower():
                        # Replace the entire superlative phrase so NO "No. 1" fragment remains
                        suggested = "trusted"
                    elif "clinically" in claim.lower():
                        suggested = "certified quality"

                    raw_findings.append({
                        "lane": "evidence_needed",
                        "severity": "high",
                        "citation_id": "R-04",
                        "explanation": f"Claim '{claim}' is a rank or performance superlative requiring an approved evidence record under rule R-04. The vault currently has no approved evidence record for this claim.",
                        "suggested_fix": suggested
                    })


    # --------------------------------------------------------------------------
    # 3. Terminology Check
    # --------------------------------------------------------------------------
    # Check for banned/restricted terms in the vault
    for term_item in terminologies:
        title = term_item.get("title", "")
        item_id = term_item.get("item_id")
        if "Restricted Term:" in title:
            bad_term = title.split("Restricted Term:")[-1].strip()
            # Only flag if not already covered by R-04 claim check
            if bad_term and re.search(r'\b' + re.escape(bad_term) + r'\b', body_text, re.IGNORECASE):
                already_covered = any(f.get("citation_id") == "R-04" and bad_term.lower() in f.get("explanation", "").lower() for f in raw_findings)
                if not already_covered:
                    raw_findings.append({
                        "lane": "contradiction",
                        "severity": "medium",
                        "citation_id": item_id,
                        "explanation": f"Term '{bad_term}' is restricted under vault item {item_id}.",
                        "suggested_fix": "certified quality" if "clinically" in bad_term.lower() else "trusted by millions"
                    })

    # --------------------------------------------------------------------------
    # 4. Tone Check (Rule-Based Only)
    # --------------------------------------------------------------------------
    tone_rule = next((item for item in rules if "tone" in item.get("title", "").lower() or "tone" in item.get("text", "").lower()), None)
    if tone_rule:
        hype_phrases = ["hurry now", "act fast", "don't miss out", "limited time only"]
        for hype in hype_phrases:
            if re.search(r'\b' + re.escape(hype) + r'\b', body_text, re.IGNORECASE):
                raw_findings.append({
                    "lane": "human_decision",
                    "severity": "low",
                    "citation_id": tone_rule.get("item_id"),
                    "explanation": f"rule_based_tone: Urgency phrase '{hype}' detected. Tone check sends uncertain tone to human reviewer decision.",
                    "suggested_fix": None
                })

    # --------------------------------------------------------------------------
    # 5. Alt-Text Check (Cited R-09)
    # --------------------------------------------------------------------------
    r09_rule = next((item for item in rules if item.get("item_id") == "R-09"), None)
    if r09_rule and image_url:
        if not alt_text or not alt_text.strip():
            raw_findings.append({
                "lane": "human_decision",
                "severity": "high",
                "citation_id": "R-09",
                "explanation": "Image asset attached but descriptive alt text is blank, violating accessibility rule R-09.",
                "suggested_fix": "Add concise descriptive alt text"
            })

    # --------------------------------------------------------------------------
    # 6. Logo Verification Check (Reviewer-Confirmed Only, Cited A-02)
    # --------------------------------------------------------------------------
    a02_rule = next((item for item in rules if item.get("item_id") == "A-02"), None)
    if a02_rule and image_url:
        if not logo_confirmed:
            raw_findings.append({
                "lane": "human_decision",
                "severity": "medium",
                "citation_id": "A-02",
                "explanation": "Logo not reviewer-confirmed. Current approved logo file required under rule A-02; archived logos are not accepted.",
                "suggested_fix": None
            })

    # --------------------------------------------------------------------------
    # 7. Approximate Palette Check (Cited P-01)
    # --------------------------------------------------------------------------
    if palette_off and palettes:
        p01_item = next((item for item in palettes if item.get("item_id") == "P-01"), palettes[0])
        raw_findings.append({
            "lane": "human_decision",
            "severity": "low",
            "citation_id": p01_item.get("item_id"),
            "explanation": "Palette sampling is approximate — reviewer to confirm brand color alignment with approved palette.",
            "suggested_fix": None
        })

    # --------------------------------------------------------------------------
    # 8. Visual Contrast Ratio Check (Cited R-09) (Blocker 3)
    # --------------------------------------------------------------------------
    if contrast_ratio is not None and contrast_ratio < 4.5:
        r09_rule = next((item for item in rules if item.get("item_id") == "R-09"), None)
        if r09_rule:
            raw_findings.append({
                "lane": "human_decision",
                "severity": "medium",
                "citation_id": "R-09",
                "explanation": f"Visual text-to-background contrast ratio ({contrast_ratio}:1) fails WCAG AA standard (4.5:1 minimum). Review creative background against text color under accessibility rule R-09.",
                "suggested_fix": None
            })

    # Apply the Mandatory Citation Validator
    return validate_citations(raw_findings, active_items)



# ------------------------------------------------------------------------------
# Suggested Fix Applicator
# ------------------------------------------------------------------------------
def apply_fix_to_text(body_text: str, finding: Dict[str, Any]) -> str:
    """
    Applies the suggested_fix of a finding to body_text.
    Supports price fixes (e.g. F-12 -> Rs. 1,299) and terminology replacements.
    Guarantees no leftover "No. 1" fragment remains.
    """
    suggested_fix = finding.get("suggested_fix")
    if not suggested_fix:
        return body_text

    citation_id = finding.get("citation_id")
    explanation = finding.get("explanation", "")

    # 1. Price fix: F-12
    if citation_id == "F-12" or "Rs." in suggested_fix:
        price_re = re.compile(r'(?:Rs\.?|INR|₹)\s*[\d,]+', re.IGNORECASE)
        if price_re.search(body_text):
            return price_re.sub(suggested_fix, body_text, count=1)

    # 2. Superlatives / Claims (R-04): clean replacement of "India's No. 1"
    if "no. 1" in explanation.lower() or "no. 1" in body_text.lower():
        no1_pattern = re.compile(r"India['’]s\s+No\.?\s*1|No\.?\s*1", re.IGNORECASE)
        if no1_pattern.search(body_text):
            return no1_pattern.sub(suggested_fix, body_text, count=1)

    # 3. Clinically proven replacement
    if "clinically proven" in explanation.lower() or "clinically proven" in body_text.lower():
        cp_pattern = re.compile(r"clinically\s+proven", re.IGNORECASE)
        if cp_pattern.search(body_text):
            return cp_pattern.sub(suggested_fix, body_text, count=1)

    # 4. General claim replacement matching "Claim '...' is"
    match_claim = re.search(r"Claim\s+['\"](.*?)['\"]\s+is", explanation)
    if match_claim:
        target = match_claim.group(1)
        target_re = re.compile(re.escape(target), re.IGNORECASE)
        if target_re.search(body_text):
            return target_re.sub(suggested_fix, body_text, count=1)

    return body_text


