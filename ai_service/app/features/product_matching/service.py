from typing import List, Dict, Any, Optional
from rapidfuzz import fuzz

from app.config.database import get_connection
from app.features.product_matching.text_normalizer import normalize_text
from app.features.product_matching.embedding_matcher import calculate_semantic_similarity

# Matching weights
FUZZY_WEIGHT = 0.6
SEMANTIC_WEIGHT = 0.4

# Confidence thresholds
MATCH_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60


def get_products():
    """
    Get all active products from PostgreSQL.
    """
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id, name, sku, aliases
            FROM products
            WHERE is_active = true
        """)
        products = cursor.fetchall()
        cursor.close()
        return products
    finally:
        connection.close()


def check_exact_match(input_text, product):
    """
    Check whether input exactly matches product name, SKU, or aliases.
    """
    normalized_input = normalize_text(input_text)
    if not normalized_input:
        return False

    name = product[1]
    sku = product[2]
    aliases = product[3]

    # Exact product name
    if normalized_input == normalize_text(name):
        return True

    # Exact SKU
    if sku and normalized_input == normalize_text(sku):
        return True

    # Exact alias
    if aliases:
        for alias in aliases:
            if normalized_input == normalize_text(alias):
                return True

    return False


def calculate_fuzzy_score(input_text, product_name, sku, aliases):
    """
    Calculate the best fuzzy ratio score using product name + SKU + aliases.
    """
    normalized_input = normalize_text(input_text)

    # Product name score
    name_score = fuzz.ratio(normalized_input, normalize_text(product_name)) / 100

    # SKU score
    sku_score = fuzz.ratio(normalized_input, normalize_text(sku or "")) / 100

    # Alias score
    alias_score = 0
    if aliases:
        for alias in aliases:
            score = fuzz.ratio(normalized_input, normalize_text(alias)) / 100
            alias_score = max(alias_score, score)

    return max(name_score, sku_score, alias_score)


def match_product(product_name: str) -> Dict[str, Any]:
    """
    Match a product using:
    1. Exact matching
    2. Fuzzy matching (Levenshtein ratio)
    3. Semantic matching (Multilingual Transformer embeddings)
    4. Combined weighted confidence (0.6 * Fuzzy + 0.4 * Semantic)
    5. Top 3 ranked candidates
    """
    products = get_products()

    if not products:
        return {
            "input": product_name,
            "matched_product": None,
            "candidates": [],
            "fuzzy_score": 0.0,
            "semantic_score": 0.0,
            "confidence": 0.0,
            "status": "NO_MATCH"
        }

    # STEP 1: Exact match
    for product in products:
        if check_exact_match(product_name, product):
            exact_product = {
                "id": product[0],
                "name": product[1],
                "sku": product[2]
            }
            return {
                "input": product_name,
                "matched_product": exact_product,
                "candidates": [
                    {
                        "id": product[0],
                        "name": product[1],
                        "sku": product[2],
                        "confidence": 1.0
                    }
                ],
                "fuzzy_score": 1.0,
                "semantic_score": 1.0,
                "confidence": 1.0,
                "status": "MATCHED"
            }

    # STEP 2: Fuzzy + Semantic matching
    candidates = []
    for product in products:
        product_id = product[0]
        name = product[1]
        sku = product[2]
        aliases = product[3]

        fuzzy_score = calculate_fuzzy_score(product_name, name, sku, aliases)
        semantic_score = calculate_semantic_similarity(product_name, name)
        confidence = (fuzzy_score * FUZZY_WEIGHT + semantic_score * SEMANTIC_WEIGHT)

        candidates.append({
            "id": product_id,
            "name": name,
            "sku": sku,
            "fuzzy_score": round(fuzzy_score, 2),
            "semantic_score": round(semantic_score, 2),
            "confidence": round(confidence, 2)
        })

    # STEP 3: Sort candidates descending
    candidates.sort(key=lambda x: x["confidence"], reverse=True)
    top_candidates = candidates[:3]
    best_candidate = top_candidates[0]

    best_confidence = best_candidate["confidence"]
    best_fuzzy_score = best_candidate["fuzzy_score"]
    best_semantic_score = best_candidate["semantic_score"]

    # STEP 4: Decide status
    if best_fuzzy_score >= 0.90 or best_confidence >= MATCH_THRESHOLD:
        status = "MATCHED"
    elif best_confidence >= REVIEW_THRESHOLD:
        status = "REVIEW_REQUIRED"
    else:
        status = "NO_MATCH"

    matched_product = None if status == "NO_MATCH" else {
        "id": best_candidate["id"],
        "name": best_candidate["name"],
        "sku": best_candidate["sku"]
    }

    return {
        "input": product_name,
        "matched_product": matched_product,
        "candidates": top_candidates,
        "fuzzy_score": best_fuzzy_score,
        "semantic_score": best_semantic_score,
        "confidence": best_confidence,
        "status": status
    }
