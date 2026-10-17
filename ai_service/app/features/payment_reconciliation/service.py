"""
Payment Reconciliation — Service Layer
Copied from app/services/reconciliation_matcher.py with import updated
to use app.config.database (shared config — no change needed here).
All matching logic is identical to the original.
"""

from datetime import datetime
from decimal import Decimal

from rapidfuzz.fuzz import ratio

from app.config.database import get_connection


# ======================================================
# CONFIGURATION
# ======================================================

AMOUNT_WEIGHT = 0.45
REFERENCE_WEIGHT = 0.30
PARTY_WEIGHT = 0.10
DATE_WEIGHT = 0.15

MATCH_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60

TOP_CANDIDATES = 5


# ======================================================
# TEXT NORMALIZATION
# ======================================================

def normalize_text(value):
    if not value:
        return ""
    value = str(value).lower().strip()
    value = "".join(char if char.isalnum() else " " for char in value)
    value = " ".join(value.split())
    return value


# ======================================================
# TEXT SIMILARITY
# ======================================================

def text_score(value1, value2):
    value1 = normalize_text(value1)
    value2 = normalize_text(value2)
    if not value1 or not value2:
        return 0.0
    if value1 == value2:
        return 1.0
    return ratio(value1, value2) / 100.0


# ======================================================
# AMOUNT SCORE
# ======================================================

def amount_score(statement_amount, record_amount):
    statement_amount = Decimal(str(statement_amount))
    record_amount = Decimal(str(record_amount))

    if statement_amount == record_amount:
        return 1.0

    difference = abs(statement_amount - record_amount)
    tolerance = statement_amount * Decimal("0.02")  # 2% tolerance

    if difference <= tolerance:
        ratio_val = float(difference / statement_amount)
        return max(0.0, 1.0 - (ratio_val / 0.02))

    return 0.0


# ======================================================
# DATE SCORE
# ======================================================

def date_score(statement_date_str, record_date_str):
    try:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                stmt_date = datetime.strptime(str(statement_date_str)[:10], fmt)
                break
            except ValueError:
                continue
        else:
            return 0.0

        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                rec_date = datetime.strptime(str(record_date_str)[:10], fmt)
                break
            except ValueError:
                continue
        else:
            return 0.0

        diff = abs((stmt_date - rec_date).days)
        if diff == 0:
            return 1.0
        if diff <= 3:
            return 0.8
        if diff <= 7:
            return 0.5
        if diff <= 30:
            return 0.2
        return 0.0
    except Exception:
        return 0.0


# ======================================================
# COMPOSITE SCORE
# ======================================================

def composite_score(
    statement_amount,
    statement_date,
    statement_reference,
    statement_narration,
    record_amount,
    record_date,
    record_reference,
    record_party,
):
    a_score = amount_score(statement_amount, record_amount)
    d_score = date_score(statement_date, record_date)
    r_score = text_score(statement_reference, record_reference)
    p_score = text_score(statement_narration, record_party)

    total = (
        a_score * AMOUNT_WEIGHT
        + r_score * REFERENCE_WEIGHT
        + p_score * PARTY_WEIGHT
        + d_score * DATE_WEIGHT
    )
    return round(total, 4)


# ======================================================
# DATABASE QUERY — CANDIDATE FETCH
# ======================================================

def fetch_ledger_candidates(user_id: int, amount: float, direction: str):
    """
    Fetch sales/purchase records from the MySQL ledger that are in
    the correct direction and within a 10% amount tolerance window.
    """
    connection = get_connection()
    candidates = []

    try:
        with connection.cursor(dictionary=True) as cursor:
            lower = amount * 0.90
            upper = amount * 1.10

            if direction.lower() == "credit":
                # Credit on bank statement = money received = sales payment
                query = """
                    SELECT
                        s.id,
                        s.bill_number AS reference,
                        s.total_amount AS amount,
                        s.sale_date AS record_date,
                        s.customer_name AS party,
                        'SALE' AS record_type
                    FROM sales s
                    WHERE s.user_id = %s
                      AND s.total_amount BETWEEN %s AND %s
                      AND s.payment_status != 'CREDIT'
                    ORDER BY s.sale_date DESC
                    LIMIT %s
                """
            else:
                # Debit on bank statement = money paid = purchase payment
                query = """
                    SELECT
                        p.id,
                        p.invoice_no AS reference,
                        p.total_amount AS amount,
                        p.purchase_date AS record_date,
                        p.supplier_name AS party,
                        'PURCHASE' AS record_type
                    FROM purchases p
                    WHERE p.user_id = %s
                      AND p.total_amount BETWEEN %s AND %s
                    ORDER BY p.purchase_date DESC
                    LIMIT %s
                """

            cursor.execute(query, (user_id, lower, upper, TOP_CANDIDATES * 3))
            candidates = cursor.fetchall()
    finally:
        connection.close()

    return candidates


# ======================================================
# MAIN RECONCILIATION FUNCTION
# ======================================================

def reconcile_transaction(
    user_id: int,
    transaction_date: str,
    amount: float,
    reference: str,
    narration: str,
    direction: str,
):
    """
    Match a bank-statement transaction against the store ledger.
    Returns top candidates sorted by composite confidence score.
    """
    raw_candidates = fetch_ledger_candidates(user_id, amount, direction)

    scored = []
    for rec in raw_candidates:
        score = composite_score(
            statement_amount=amount,
            statement_date=transaction_date,
            statement_reference=reference,
            statement_narration=narration,
            record_amount=float(rec.get("amount", 0)),
            record_date=str(rec.get("record_date", "")),
            record_reference=str(rec.get("reference", "")),
            record_party=str(rec.get("party", "")),
        )
        scored.append({**rec, "confidence": score})

    scored.sort(key=lambda x: x["confidence"], reverse=True)
    top_candidates = scored[:TOP_CANDIDATES]

    best_match = None
    status = "UNMATCHED"

    if top_candidates:
        top = top_candidates[0]
        if top["confidence"] >= MATCH_THRESHOLD:
            best_match = top
            status = "MATCHED"
        elif top["confidence"] >= REVIEW_THRESHOLD:
            best_match = top
            status = "REVIEW_REQUIRED"

    return {
        "candidates": top_candidates,
        "best_match": best_match,
        "status": status,
    }
