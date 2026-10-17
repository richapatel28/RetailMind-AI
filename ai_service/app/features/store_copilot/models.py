"""
RetailMind AI - Store Copilot (Local RAG) Models
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class RAGSource(BaseModel):
    doc_type: str = Field(..., description="Document type: SUPPLIER_INVOICE, CUSTOMER_CREDIT, INVENTORY, SALE_RECORD")
    reference_id: str = Field(..., description="Unique document reference e.g. INV001, BILL-20260908-0018")
    relevance_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    excerpt: str = Field(..., description="Document chunk text retrieved")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata key-value pairs")


class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language question in en, hi, mr, or gu")
    language: str = Field(default="en", description="Target language: en, hi, mr, or gu")
    store_data: Dict[str, Any] = Field(default_factory=dict, description="Contextual store records")
    top_k: int = Field(default=4, description="Top relevant document chunks to retrieve")


class RAGQueryResponse(BaseModel):
    query: str
    language: str
    answer: str = Field(..., description="Synthesized grounded answer citing exact records")
    sources: List[RAGSource] = Field(default_factory=list, description="Grounding source citations")
    confidence: float = Field(..., description="Retrieval similarity confidence")
