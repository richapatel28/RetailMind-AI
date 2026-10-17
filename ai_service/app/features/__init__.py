"""
app.features — RetailMind AI Feature Registry

Each sub-package is a fully self-contained AI/ML feature:
  - product_matching      : Multilingual product catalog matching
  - store_copilot         : Local RAG store query engine
  - voice_sales           : Whisper + ML voice order parsing
  - invoice_processing    : Gemini Vision invoice extraction
  - payment_reconciliation: Bank-statement-to-ledger matching
  - operations_agent      : Autonomous ReAct inventory/credit agent
"""

from .product_matching.router import router as product_matching_router
from .store_copilot.router import router as store_copilot_router
from .voice_sales.router import router as voice_sales_router
from .invoice_processing.router import router as invoice_processing_router
from .payment_reconciliation.router import router as payment_reconciliation_router
from .operations_agent.router import router as operations_agent_router

__all__ = [
    "product_matching_router",
    "store_copilot_router",
    "voice_sales_router",
    "invoice_processing_router",
    "payment_reconciliation_router",
    "operations_agent_router",
]
