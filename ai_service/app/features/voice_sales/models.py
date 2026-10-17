from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class MatchedProduct(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    sku: Optional[str] = None


class ProductCandidate(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    fuzzy_score: Optional[float] = None
    semantic_score: Optional[float] = None
    confidence: float = 0.0


class ProductMatchSummary(BaseModel):
    input: Optional[str] = None
    matched_product: Optional[MatchedProduct] = None
    candidates: List[Dict[str, Any]] = Field(default_factory=list)
    fuzzy_score: Optional[float] = None
    semantic_score: Optional[float] = None
    confidence: Optional[float] = None
    status: Optional[str] = None


class VoiceValidation(BaseModel):
    valid: bool = True
    errors: List[str] = Field(default_factory=list)


class VoiceItem(BaseModel):
    product_text: Optional[str] = None
    quantity: float = 1.0
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    product_match: Optional[ProductMatchSummary] = None


class VoiceParseResponse(BaseModel):
    transcript: str
    intent: str
    product_text: Optional[str] = None
    quantity: Optional[float] = None
    amount: Optional[float] = None
    customer: Optional[str] = None
    payment_mode: str = "unknown"
    language: str = "en"
    confidence: float = 0.0
    status: str = "PROCESSED"
    product_match: Optional[ProductMatchSummary] = None
    items: List[VoiceItem] = Field(default_factory=list)
    validation: VoiceValidation

