# Invoice Processing — Feature Documentation

## Overview
Extracts structured data from invoice images and PDFs using **Gemini Vision** (multimodal LLM), then validates arithmetic consistency and enriches each line item via the product-matching feature.

---

## Folder Structure
```
invoice_processing/
├── models.py              # Pydantic schemas (raw + response)
├── service.py             # Gemini Vision + validation + product matching
├── router.py              # FastAPI endpoint
├── __init__.py
├── dataset/
│   └── sample_invoice_payload.json   # Test cases
└── README.md
```

---

## API Endpoint

| Method | Path | Input | Description |
|--------|------|-------|-------------|
| POST | `/ai/invoice/extract` | `multipart/form-data` file | Extract from image/PDF |

**Supported formats**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`

---

## Processing Pipeline

```
Invoice Image/PDF
      │
      ▼
┌─────────────────────────────────┐
│  1. Gemini Vision Extraction     │
│     Model: gemini-2.5-flash-lite │
│     Output: RawInvoiceData JSON  │
│     (structured output mode)     │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  2. Deterministic Validation     │
│     qty × unit_price = item_total│
│     Σ item_totals = subtotal     │
│     subtotal - discount + tax    │
│                       = total    │
│     total - paid = due           │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  3. Product Matching             │
│     Each line item product name  │
│     → product_matching feature   │
│     (exact → fuzzy → semantic)   │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  4. Confidence & Status          │
│     item confidence = 0.4 +      │
│            0.6 × match_score     │
│     overall = avg(item_conf)     │
│            - validation_penalty  │
└─────────────────────────────────┘
      │
      ▼
   InvoiceExtractResponse JSON
```

---

## Architecture: Intelligent OCR + RAG (Retrieval-Augmented Grounding)

The Invoice Intelligence feature combines **Document Vision OCR** with **Store Catalog RAG**:

1. **OCR Layer (Optical Character Recognition & Extraction)**:
   - Powered by Gemini Multimodal Vision (`gemini-2.5-flash-lite` / `gemini-2.5-flash`).
   - Converts visual images (printed invoices, handwritten kirana slips, thermal receipts, PDFs) into structured JSON tokens: supplier name, invoice date, line items, quantities, costs, and totals.
   - Eliminates template brittleness across diverse invoice formats.

2. **RAG Layer (Retrieval-Augmented Grounding against Catalog)**:
   - Raw OCR strings often contain typos, regional abbreviations, or supplier-specific product codes (e.g., "Tata Nmk 1k", "Maggi ndls").
   - **Retrieval**: The system computes multilingual dense vector embeddings (`paraphrase-multilingual-MiniLM-L12-v2`) and executes semantic similarity search across the store's internal catalog and purchase records.
   - **Augmentation & Grounding**: The retrieved context identifies the canonical store product ID, SKU, previous purchase rates, and standard units.

3. **Unavailable / New Product Auto-Creation Workflow**:
   - If an extracted item is **unavailable** in the existing catalog (`NO_MATCH` or marked `__NEW__`):
     - It does **not** fail the invoice.
     - The merchant can review and confirm the new item.
     - Upon confirmation, the backend automatically **creates the new product** in PostgreSQL (`INSERT INTO products`), generates a unique SKU, sets the purchase cost, applies a standard retail margin (e.g., 25% markup) for selling price, and updates inventory stock immediately.

---

## Status Values
| Status | Meaning |
|--------|---------|
| `MATCHED` | All items matched to existing catalog items, validation passed |
| `REVIEW_REQUIRED` | Contains new/unavailable items or math validation flags |
| `PROCESSED` | Extracted successfully; ready for review or confirmation |

---

## Environment Variables
```
GEMINI_API_KEY=your-key-here
GEMINI_INVOICE_MODEL=gemini-2.5-flash-lite   # optional override
```
