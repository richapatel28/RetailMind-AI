from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ProductMatchRequest(BaseModel):
    product_name: str = Field(..., description="Product name or noisy text extracted from invoice/speech")


class CandidateProduct(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    fuzzy_score: float
    semantic_score: float
    confidence: float


class ProductMatchResponse(BaseModel):
    input: str
    matched_product: Optional[Dict[str, Any]] = None
    candidates: List[Dict[str, Any]] = []
    fuzzy_score: float
    semantic_score: float
    confidence: float
    status: str  # MATCHED, REVIEW_REQUIRED, NO_MATCH
