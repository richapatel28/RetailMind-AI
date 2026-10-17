"""
Payment Reconciliation — Pydantic Models
Request / response schemas for the bank-statement-to-ledger matching endpoint.
"""

from pydantic import BaseModel
from typing import Optional, List


class ReconciliationRequest(BaseModel):
    """A single bank-statement transaction to be matched against store ledger records."""

    transaction_date: str
    """ISO date string e.g. '2024-03-15'"""

    amount: float
    """Transaction amount (positive)."""

    reference: Optional[str] = None
    """Bank reference / UTR number (optional)."""

    narration: Optional[str] = None
    """Bank narration / description text (optional)."""

    direction: str
    """'credit' or 'debit'."""


class ReconciliationResponse(BaseModel):
    """Matched result with ranked candidates and confidence score."""

    transaction: ReconciliationRequest
    """The original transaction that was submitted."""

    candidates: List[dict]
    """Top-N ledger candidates with individual scores."""

    best_match: Optional[dict] = None
    """Highest-confidence candidate, or null if unmatched."""

    confidence: float = 0.0
    """Overall match confidence 0.0–1.0."""

    status: str
    """MATCHED | REVIEW_REQUIRED | UNMATCHED"""
