import logging
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.features.invoice_processing.models import InvoiceExtractResponse
from app.features.invoice_processing.service import (
    process_invoice_extraction,
    SUPPORTED_MIME_TYPES
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai/invoice",
    tags=["Invoice Intelligence"]
)


@router.post("/extract", response_model=InvoiceExtractResponse)
async def extract_invoice(file: UploadFile = File(...)):
    """
    Upload an invoice image or PDF to extract structured data via Gemini Vision.

    - Accepts: .jpg, .jpeg, .png, .webp, .pdf
    - Extracts: supplier, invoice number, date, line items, totals, tax, due
    - Validates: arithmetic consistency (qty × price, subtotal, total, due)
    - Enriches: each line item with product-catalog match results
    - Returns: structured JSON with overall confidence score and status
    """
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Invoice file must have a valid filename"
        )

    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_MIME_TYPES:
        supported = ", ".join(SUPPORTED_MIME_TYPES.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{suffix}'. Supported formats: {supported}"
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        result = process_invoice_extraction(
            file_bytes=file_bytes,
            filename=file.filename
        )
        return result

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Invoice extraction error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Invoice processing failed: {str(exc)}"
        )
