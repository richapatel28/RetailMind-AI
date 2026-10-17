"""
Invoice Processing — Pydantic Models
Covers the raw Gemini structured-output schema and the enriched API response
schema that includes product-matching results per line item.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ---------------------------------------------------------
# Raw Schema — used as Gemini response_schema for structured output
# ---------------------------------------------------------

class RawInvoiceItem(BaseModel):
    product: Optional[str] = Field(default=None)
    sku: Optional[str] = Field(default=None)
    quantity: Optional[float] = Field(default=None)
    unit: Optional[str] = Field(default=None)
    unit_price: Optional[float] = Field(default=None)
    item_total: Optional[float] = Field(default=None)


class RawInvoiceData(BaseModel):
    supplier: Optional[str] = Field(default=None)
    invoice_number: Optional[str] = Field(default=None)
    date: Optional[str] = Field(default=None)
    customer: Optional[str] = Field(default=None)
    items: List[RawInvoiceItem] = Field(default_factory=list)
    subtotal: Optional[float] = Field(default=None)
    discount: Optional[float] = Field(default=None)
    tax: Optional[float] = Field(default=None)
    total: Optional[float] = Field(default=None)
    paid: Optional[float] = Field(default=None)
    due: Optional[float] = Field(default=None)


# ---------------------------------------------------------
# API Response Schema — enriched with product-matching results
# ---------------------------------------------------------

class InvoiceItemProductMatch(BaseModel):
    input: Optional[str] = None
    matched_product: Optional[Dict[str, Any]] = None
    candidates: List[Dict[str, Any]] = Field(default_factory=list)
    fuzzy_score: Optional[float] = None
    semantic_score: Optional[float] = None
    confidence: Optional[float] = None
    status: Optional[str] = None


class ExtractedInvoiceItem(BaseModel):
    product_text: Optional[str] = None
    sku: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total: Optional[float] = None
    product_match: Optional[InvoiceItemProductMatch] = None
    confidence: float = 0.0


class InvoiceValidation(BaseModel):
    is_valid: bool = True
    calculated_subtotal: Optional[float] = None
    issues: List[str] = Field(default_factory=list)


class InvoiceExtractResponse(BaseModel):
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    customer: Optional[str] = None
    items: List[ExtractedInvoiceItem] = Field(default_factory=list)
    subtotal: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    grand_total: Optional[float] = None
    paid: Optional[float] = None
    due: Optional[float] = None
    validation: InvoiceValidation
    confidence: float = 0.0
    status: str = "PROCESSED"
