import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.features.invoice_processing.models import (
    RawInvoiceData,
    RawInvoiceItem,
    InvoiceExtractResponse,
    ExtractedInvoiceItem,
    InvoiceItemProductMatch,
    InvoiceValidation
)
from app.features.product_matching.service import match_product

logger = logging.getLogger(__name__)

load_dotenv()


# =========================================================
# 1. GEMINI PROMPT
# =========================================================

PROMPT = """
You are an invoice information extraction system for a retail
automation application.

Analyze the supplied invoice image carefully.

The invoice may be:
- printed
- handwritten
- supermarket invoice
- kirana-shop bill
- thermal receipt
- tax invoice
- semi-structured document

Different invoices can have completely different layouts.

Do NOT assume a fixed position, table structure, column order,
or invoice format.

Extract only information that is visible in the invoice.

Extract:

- supplier
- invoice_number
- date
- customer
- items
    - product
    - sku
    - quantity
    - unit
    - unit_price
    - item_total
- subtotal
- discount
- tax
- total
- paid
- due

IMPORTANT:

- Extract ALL identifiable products.
- Do not extract only the first product.
- Do not invent missing information.
- If a field is not visible or cannot be confidently identified,
  return null.
- Do not assume quantity = 1 unless clearly indicated.
- Do not confuse unit price and item total.
- Do not confuse subtotal, discount, total, paid and due.
- Preserve product names as they appear.
- Do not guess unclear product names.
- Keep separate invoice lines as separate items.
- Numbers must be numeric values.
- invoice_number must remain a string.
- Carefully inspect handwritten invoices.
- Base the answer only on the supplied image.
"""

SUPPORTED_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf"
}


def get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY not configured. Set it in ai_service/.env"
        )
    return genai.Client(api_key=api_key)


# =========================================================
# 2. NUMERIC & DETERMINISTIC VALIDATION
# =========================================================

def calculate_item_total(item: RawInvoiceItem) -> Optional[float]:
    if item.quantity is None or item.unit_price is None:
        return None
    return round(float(item.quantity) * float(item.unit_price), 2)


def validate_items(invoice: RawInvoiceData) -> List[str]:
    issues = []
    for index, item in enumerate(invoice.items, start=1):
        calculated = calculate_item_total(item)
        if calculated is None:
            continue
        if item.item_total is None:
            issues.append(
                f"Item {index} ({item.product or 'unnamed'}): "
                f"item total is missing; calculated value = {calculated}"
            )
        elif abs(calculated - float(item.item_total)) > 0.05:
            issues.append(
                f"Item {index} ({item.product or 'unnamed'}): "
                f"quantity × unit price = {calculated}, "
                f"but extracted item total = {item.item_total}"
            )
    return issues


def calculate_subtotal(invoice: RawInvoiceData) -> Optional[float]:
    if not invoice.items:
        return None
    totals = []
    for item in invoice.items:
        if item.item_total is None:
            return None
        totals.append(float(item.item_total))
    return round(sum(totals), 2)


def validate_totals(invoice: RawInvoiceData) -> List[str]:
    issues = []
    calc_subtotal = calculate_subtotal(invoice)

    if calc_subtotal is not None:
        if invoice.subtotal is None:
            issues.append(f"Subtotal missing; calculated subtotal = {calc_subtotal}")
        elif abs(float(invoice.subtotal) - calc_subtotal) > 0.05:
            issues.append(
                f"Subtotal mismatch: extracted = {invoice.subtotal}, "
                f"calculated = {calc_subtotal}"
            )

    if calc_subtotal is not None and invoice.total is not None:
        discount_val = float(invoice.discount) if invoice.discount is not None else 0.0
        tax_val = float(invoice.tax) if invoice.tax is not None else 0.0
        expected_total = round(calc_subtotal - discount_val + tax_val, 2)
        diff = abs(expected_total - float(invoice.total))
        if diff > 0.05:
            diff_from_subtotal = round(float(invoice.total) - (calc_subtotal - discount_val), 2)
            if diff_from_subtotal > 0 and tax_val == 0.0:
                pass  # Tax embedded in line items (GST-inclusive pricing)
            else:
                issues.append(
                    f"Total mismatch: subtotal - discount + tax = {expected_total}, "
                    f"extracted total = {invoice.total}"
                )

    if (
        invoice.total is not None
        and invoice.paid is not None
        and invoice.due is not None
    ):
        expected_due = round(float(invoice.total) - float(invoice.paid), 2)
        if abs(expected_due - float(invoice.due)) > 0.05:
            issues.append(
                f"Due mismatch: total - paid = {expected_due}, "
                f"extracted due = {invoice.due}"
            )

    return issues


def validate_invoice(invoice: RawInvoiceData) -> Dict[str, Any]:
    issues = []
    issues.extend(validate_items(invoice))
    issues.extend(validate_totals(invoice))
    calc_subtotal = calculate_subtotal(invoice)
    return {
        "is_valid": len(issues) == 0,
        "calculated_subtotal": calc_subtotal,
        "issues": issues,
    }


# =========================================================
# 3. GEMINI VISION INFERENCE
# =========================================================

def extract_raw_invoice(file_bytes: bytes, filename: str) -> RawInvoiceData:
    suffix = Path(filename).suffix.lower()
    mime_type = SUPPORTED_MIME_TYPES.get(suffix)

    if not mime_type:
        supported_str = ", ".join(SUPPORTED_MIME_TYPES.keys())
        raise ValueError(
            f"Unsupported file format '{suffix}'. Supported: {supported_str}"
        )

    client = get_client()
    model_name = os.getenv("GEMINI_INVOICE_MODEL", "gemini-2.5-flash-lite")

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                PROMPT,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RawInvoiceData,
                temperature=0,
            ),
        )
        return RawInvoiceData.model_validate_json(response.text)
    except Exception as exc:
        logger.warning(f"Primary model '{model_name}' failed: {exc}. Trying fallback 'gemini-2.5-flash'...")
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    PROMPT,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RawInvoiceData,
                    temperature=0,
                ),
            )
            return RawInvoiceData.model_validate_json(response.text)
        except Exception as fallback_exc:
            logger.error(f"Fallback model also failed: {fallback_exc}")
            raise exc


# =========================================================
# 4. HIGH-LEVEL PIPELINE WITH PRODUCT MATCHING
# =========================================================

def process_invoice_extraction(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Full invoice processing pipeline:
    1. Gemini Vision — structured extraction from image/PDF
    2. Deterministic numeric validation (qty × price, subtotal, totals, due)
    3. Product matching per line item using RetailMind product_matcher
    4. Confidence scoring and overall status
    """
    raw_invoice = extract_raw_invoice(file_bytes, filename)
    validation_info = validate_invoice(raw_invoice)

    processed_items: List[Dict[str, Any]] = []
    item_confidences: List[float] = []
    has_unmatched_items = False

    for item in raw_invoice.items:
        prod_text = (item.product or "").strip()
        match_summary = None
        item_confidence = 0.5

        if prod_text:
            try:
                match_result = match_product(prod_text)
                match_summary = match_result
                prod_match_conf = float(match_result.get("confidence", 0.0))
                item_confidence = round(0.4 + (0.6 * prod_match_conf), 2)
                if match_result.get("status") in ["REVIEW_REQUIRED", "NO_MATCH"]:
                    has_unmatched_items = True
            except Exception as match_err:
                logger.error(f"Product match failed for '{prod_text}': {match_err}")
                match_summary = {
                    "input": prod_text,
                    "matched_product": None,
                    "candidates": [],
                    "confidence": 0.0,
                    "status": "ERROR"
                }
                has_unmatched_items = True
        else:
            has_unmatched_items = True

        item_confidences.append(item_confidence)
        processed_items.append({
            "product_text": prod_text or None,
            "sku": getattr(item, "sku", None),
            "quantity": item.quantity,
            "unit": item.unit,
            "unit_price": item.unit_price,
            "total": item.item_total,
            "product_match": match_summary,
            "confidence": item_confidence
        })

    avg_item_conf = (sum(item_confidences) / len(item_confidences)) if item_confidences else 0.5
    validation_penalty = 0.0 if validation_info["is_valid"] else 0.2
    overall_confidence = round(max(0.1, min(1.0, avg_item_conf - validation_penalty)), 2)

    if not validation_info["is_valid"]:
        status = "REVIEW_REQUIRED"
    elif has_unmatched_items:
        status = "REVIEW_REQUIRED"
    elif processed_items:
        status = "MATCHED"
    else:
        status = "PROCESSED"

    return {
        "supplier": raw_invoice.supplier,
        "invoice_number": raw_invoice.invoice_number,
        "invoice_date": raw_invoice.date,
        "customer": raw_invoice.customer,
        "items": processed_items,
        "subtotal": raw_invoice.subtotal,
        "discount": raw_invoice.discount,
        "tax": raw_invoice.tax,
        "grand_total": raw_invoice.total,
        "paid": raw_invoice.paid,
        "due": raw_invoice.due,
        "validation": validation_info,
        "confidence": overall_confidence,
        "status": status
    }
