# Feature 02: Supplier Invoice Intelligence (OCR & Automated Stock Ingestion)
## Step-by-Step Build Guide & Feature Walkthrough

---

## 1. How This Feature Was Built

### Step 1: Redesigned Two-Option Entrypoint
- The user interface in `frontend/src/pages/Invoice.jsx` was streamlined to offer two distinct, intuitive paths:
  - **Option A: Enter Invoice Manually** — For quickly logging simple distributor purchases without taking a photo.
  - **Option B: Upload Supplier Bill** — For automated AI OCR reading from PDF, JPG, or PNG files.

### Step 2: Multimodal Gemini OCR Parser
- In `ai_service/app/services/invoice_service.py`, integrated Google Gemini 1.5 Flash Vision.
- The model receives high-resolution bill photos and executes structured extraction constrained to JSON schema:
  - Header: `supplier_name`, `invoice_no`, `date`, `total_amount`
  - Table lines: `items: [{ description, quantity, unit_price, total }]`
- Gracefully extracts messy Indian Kirana invoices including handwritten numbers and printed tax receipts.

### Step 3: Automated Stock Refill & New Product Creation
- Developed `createPurchase` in `backend/src/controllers/purchaseController.js`.
- Implemented smart reconciliation during ingestion:
  - **Existing Products**: Finds product by ID or fuzzy alias matching. Executes `UPDATE products SET current_stock = current_stock + qty, purchase_price = unit_cost`.
  - **Brand New Products**: When a line item (e.g. "Dettol Soap") is not found in the store catalog, it automatically generates a new SKU, creates the product with `current_stock = qty`, and sets `purchase_price = unit_cost` and a default retail markup.

### Step 4: Purchase Receipt & Catalog Refresh
- Emits real-time feedback with a breakdown of:
  - How many existing items were refilled.
  - Which new products were auto-created in the inventory.
  - Total purchase outlay recorded against financial analytics.

---

## 2. End-to-End User Journey

```
[Shopkeeper navigates to Supplier Invoices]
                    │
                    ▼
[Chooses: "Upload Supplier Bill" or "Enter Manually"]
                    │
                    ▼
[Uploads invoice photo containing Soap & Maggi]
                    │
                    ▼
[AI extracts line items in ~1.5 seconds]
  ├── Line 1: Maggi 140g (Qty: 24, Unit Cost: ₹10) -> Matched existing (Stock: 10 -> 34)
  └── Line 2: Dettol Soap (Qty: 30, Unit Cost: ₹35) -> ✨ Brand New Product detected!
                    │
                    ▼
[Review Table displayed with editable quantities & prices]
                    │
                    ▼
[Shopkeeper taps "Confirm & Refill Inventory"]
                    │
                    ▼
[Database Transaction Commits:]
  ├── Purchase #12 logged
  ├── Maggi stock increased from 10 to 34
  ├── Dettol Soap created with 30 in stock
  └── Success notification displayed with updated inventory count!
```

---

## 3. Test Cases & Verification

### Test Case 1: Automated Stock Ingestion for Existing Product
1. Note current stock of "Coca Cola" (e.g., 40 units).
2. Upload an invoice with `Coca Cola: 20 units @ ₹10`.
3. Tap **"Confirm & Ingest Stock"**.
4. Check inventory (`GET /api/products`): Stock of Coca Cola is now **60 units**.

### Test Case 2: Auto-Creation of New Products
1. Upload an invoice containing an item never before sold in the store (e.g., `"Lux Beauty Soap"`).
2. Tap **"Confirm & Ingest Stock"**.
3. In PostgreSQL:
   - Verify `SELECT * FROM products WHERE name ILIKE '%Lux%'` returns a newly created row.
   - Verify `current_stock` matches the invoice quantity (e.g., 25).
   - Verify `purchase_price` matches invoice unit cost.

### Test Case 3: Manual Invoice Entry
1. Select "Enter Invoice Manually".
2. Type supplier name: "Balaji Provisions".
3. Select an item from the searchable dropdown, enter quantity and cost.
4. Tap submit — verify purchase appears on dashboard and stock is updated.
