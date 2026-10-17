"""
RetailMind AI - Store Intelligence Copilot Router (Local Multilingual RAG)
"""

from fastapi import APIRouter, HTTPException
from app.features.store_copilot.models import RAGQueryRequest, RAGQueryResponse
from app.features.store_copilot.service import rag_engine

router = APIRouter(
    prefix="/ai/copilot",
    tags=["Store Intelligence Copilot (RAG)"]
)


@router.post("/query", response_model=RAGQueryResponse)
def query_store_copilot(payload: RAGQueryRequest):
    """
    Query Store Intelligence Copilot using local RAG over store records.
    Answers queries grounded in supplier invoices, customer credit ledgers, and sales.
    """
    try:
        result = rag_engine.query(
            user_query=payload.query,
            store_data=payload.store_data,
            language=payload.language,
            top_k=payload.top_k
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Store Copilot RAG execution failed: {str(e)}"
        )
