from app.features.product_matching.service import match_product
from app.features.product_matching.embedding_matcher import calculate_semantic_similarity, get_embedding, model
from app.features.product_matching.text_normalizer import normalize_text
from app.features.product_matching.models import ProductMatchRequest, ProductMatchResponse
from app.features.product_matching.router import router

__all__ = [
    "match_product",
    "calculate_semantic_similarity",
    "get_embedding",
    "model",
    "normalize_text",
    "ProductMatchRequest",
    "ProductMatchResponse",
    "router"
]
