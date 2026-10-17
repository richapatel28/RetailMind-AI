# Payment Reconciliation — Feature Documentation

## Overview
Automatically matches bank-statement transactions against the store's internal sales/purchase ledger using a **weighted multi-signal scoring algorithm** — no ML model, no LLM.

---

## Folder Structure
```
payment_reconciliation/
├── models.py              # Pydantic request/response schemas
├── service.py             # Scoring engine + DB query
├── router.py              # FastAPI endpoint
├── __init__.py
├── dataset/
│   └── sample_reconciliation_cases.json
└── README.md
```

---

## API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/reconciliation/match` | Match one bank transaction |

**Query param**: `user_id` (int)

---

## Scoring Algorithm

### Composite Score Formula

```
score = (amount_score  × 0.45)
      + (reference_score × 0.30)
      + (date_score    × 0.15)
      + (party_score   × 0.10)
```

### Individual Signal Scores

| Signal | Method | Detail |
|--------|--------|--------|
| `amount_score` | Exact match + 2% tolerance window | 1.0 exact, linear decay within 2% |
| `reference_score` | `rapidfuzz.ratio` on normalised strings | UTR vs bill_number |
| `date_score` | Calendar day difference | 0 days=1.0, ≤3=0.8, ≤7=0.5, ≤30=0.2 |
| `party_score` | `rapidfuzz.ratio` on narration vs party name | Bank narration vs customer/supplier |

### Decision Thresholds

| Confidence | Status |
|-----------|--------|
| ≥ 0.85 | `MATCHED` |
| 0.60 – 0.84 | `REVIEW_REQUIRED` |
| < 0.60 | `UNMATCHED` |

---

## Technique Used
**Rule-based weighted scoring + fuzzy string matching** — deterministic algorithm:
- `rapidfuzz` library for Levenshtein ratio comparison
- `Decimal` arithmetic for exact amount comparison
- Multi-signal composite scoring (weighted sum)

**No ML training, no LLM** — fully deterministic and explainable.

---

## Direction Mapping

| Bank Statement | Store Ledger |
|---------------|-------------|
| `credit` (money received) | Sales records |
| `debit` (money paid) | Purchase records |

---

## Example Request
```json
POST /ai/reconciliation/match?user_id=1
{
  "transaction_date": "2024-03-15",
  "amount": 1450.00,
  "reference": "UTR123456789",
  "narration": "Payment from Ramesh Kumar",
  "direction": "credit"
}
```
