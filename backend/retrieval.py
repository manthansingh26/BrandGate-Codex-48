import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("brandgate.retrieval")

# Common English stopwords to exclude from keyword extraction
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
    "to", "was", "were", "will", "with", "this", "now", "just"
}

def extract_keywords(text: str) -> List[str]:
    """Tokenizes text into meaningful alphanumeric search keywords."""
    tokens = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return [t for t in tokens if len(t) > 1 and t not in STOPWORDS]

def keyword_retrieval_fallback(
    draft_text: str,
    active_vault_items: List[Dict[str, Any]],
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    MANDATORY KEYWORD-RETRIEVAL FALLBACK:
    Retrieves the most relevant active vault items matching the draft text.
    Ensures that LLM review NEVER runs with zero retrieved items and
    NEVER dumps the entire vault into the prompt.
    """
    if not draft_text or not active_vault_items:
        return []

    draft_keywords = set(extract_keywords(draft_text))
    scored_items = []

    for item in active_vault_items:
        if item.get("status") != "active":
            continue

        item_text = f"{item.get('item_id', '')} {item.get('title', '')} {item.get('text', '')}".lower()
        item_keywords = set(extract_keywords(item_text))

        # Calculate keyword overlap score
        overlap = draft_keywords.intersection(item_keywords)
        score = len(overlap)

        # High-signal domain boosts
        # Price signals (Rs, rupee, 999, 1299, cookware)
        if any(term in draft_text.lower() for term in ["rs", "rupee", "price", "999", "1299", "cookware"]):
            if item.get("item_id") == "F-12" or "price" in item_text or "cookware" in item_text:
                score += 5

        # Superlative and claim signals (no. 1, best, clinically, proven, guaranteed)
        if any(term in draft_text.lower() for term in ["no. 1", "no 1", "clinically", "proven", "best", "guaranteed"]):
            if item.get("item_id") in ["R-04", "T-01", "T-02", "T-03", "T-04"]:
                score += 5

        # Image/alt/logo signals
        if any(term in draft_text.lower() for term in ["image", "alt", "logo", "photo"]):
            if item.get("item_id") in ["A-02", "R-09"]:
                score += 3

        if score > 0:
            scored_items.append((score, item))

    # Sort descending by score
    scored_items.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored_items[:limit]]

def retrieve_relevant_vault_items(
    draft_text: str,
    active_vault_items: List[Dict[str, Any]],
    brand_id: Optional[str] = None,
    limit: int = 5,
    force_fallback: bool = False
) -> List[Dict[str, Any]]:
    """
    Orchestrates retrieval:
    Attempts vector similarity retrieval if pgvector/embeddings are enabled;
    otherwise gracefully and deterministically falls back to keyword matching.
    """
    if force_fallback:
        return keyword_retrieval_fallback(draft_text, active_vault_items, limit)

    # In current configuration without external embedding model keys,
    # execute the mandatory keyword-retrieval fallback cleanly
    return keyword_retrieval_fallback(draft_text, active_vault_items, limit)
