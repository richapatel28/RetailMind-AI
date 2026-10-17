from fastapi import APIRouter, HTTPException

from app.features.payment_reconciliation.models import (
    ReconciliationRequest,
    ReconciliationResponse
)
from app.features.payment_reconciliation.service import reconcile_transaction

router = APIRouter(
    prefix="/ai/reconciliation",
    tags=["Payment Reconciliation"]
)


@router.post("/match", response_model=ReconciliationResponse)
def match_payment(user_id: int, transaction: ReconciliationRequest):
    """
    Match a bank-statement transaction against the store's sales/purchase ledger.

    Scoring weights:
      - Amount match: 45%
      - Reference/UTR match: 30%
      - Date proximity: 15%
      - Party/narration match: 10%

    Status:
      - MATCHED          → confidence ≥ 0.85
      - REVIEW_REQUIRED  → confidence 0.60–0.84
      - UNMATCHED        → confidence < 0.60
    """
    try:
        result = reconcile_transaction(
            user_id=user_id,
            transaction_date=transaction.transaction_date,
            amount=transaction.amount,
            reference=transaction.reference,
            narration=transaction.narration,
            direction=transaction.direction
        )

        best_match = result.get("best_match")
        confidence = float(best_match.get("confidence", 0.0)) if best_match else 0.0

        return {
            "transaction": transaction,
            "candidates": result.get("candidates", []),
            "best_match": best_match,
            "confidence": confidence,
            "status": result.get("status", "UNMATCHED")
        }

    except Exception as error:
        print("RECONCILIATION ERROR:", str(error))
        raise HTTPException(status_code=500, detail="Payment reconciliation failed")
