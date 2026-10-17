# Feature 04: Smart Product Matching & Catalog Management
## Step-by-Step Build Guide & Feature Walkthrough

---

## 1. How This Feature Was Built

### Step 1: Database Schema with PostgreSQL Array Aliases
- In `backend/database/schema.sql`, added `aliases TEXT[] DEFAULT '{}'` to the `products` table.
- Seeded primary grocery products with common Indian Kirana synonyms, misspellings, and phonetic transliterations (e.g. `['coke', 'cocacola', 'coca-cola']`).

### Step 2: Intelligent Multi-Tier Matching Engine
- In `backend/src/controllers/aiController.js` and `ai_service/app/services/product_matching_service.py`:
  1. **Exact Match**: Checks if input query equals `name` or exists inside `aliases`.
  2. **Substring/Containment**: Checks if brand name is contained within the speech phrase.
  3. **Levenshtein Fuzzy Scoring**: Handles typos (e.g., "maggie" $\rightarrow$ "Maggi").
  4. **Phonetic Handling**: Handles common accent or speech transcription misinterpretations (e.g., "sofxl" $\rightarrow$ "Surf Excel").

### Step 3: Frontend Product Matching Tester Screen
- In `frontend/src/pages/ProductMatching.jsx`, developed an interactive search and query lab:
  - Input field for typing arbitrary spoken or messy product queries.
  - Confidence meter (Green for $>75\%$, Yellow for $50-74\%$, Red for $<50\%$).
  - Candidate breakdown table showing matched SKU, category, stock level, and match scores.

### Step 4: Catalog & Stock Inventory View
- In `frontend/src/pages/Inventory.jsx`:
  - Searchable, sortable list of all active products.
  - Real-time stock counters with color-coded warning badges for items at or below reorder level.
  - Retail price and cost price visibility for margin tracking.

---

## 2. End-to-End User Journey

```
[Shopkeeper / Voice Assistant enters phrase: "cocacola"]
                         │
                         ▼
[Product Matching Engine executes multi-tier search]
  ├── Exact match against product name: No
  ├── Alias array search: Matched "cocacola" in ['coke', 'cocacola', ...] -> Match!
                         │
                         ▼
[Response returned in <20ms with 100% confidence]
  ├── Product: Coca Cola 500ml (ID: 1, SKU: COKE-500ML)
  ├── Selling Price: ₹15.00
  └── Stock Available: 48 units
```

---

## 3. Test Cases & Verification

### Test Case 1: Misspelling "maggie" $\rightarrow$ "Maggi Noodles"
1. In the search box or via API, submit `"maggie"`.
2. Expected Result:
   - Matches `Maggi Noodles (140g)`.
   - Confidence: $\ge 90\%$.

### Test Case 2: Colloquial Term "sofxl" $\rightarrow$ "Surf Excel"
1. Submit query: `"sofxl"`.
2. Expected Result:
   - Matches `Surf Excel Detergent 500g`.
   - Confidence: $\ge 85\%$.

### Test Case 3: Joined Word "cocacola" $\rightarrow$ "Coca Cola"
1. Submit query: `"cocacola"`.
2. Expected Result:
   - Matches `Coca Cola 500ml`.
   - Confidence: $100\%$.

### Test Case 4: Brand New Unmatched Product
1. Submit query: `"Organic Chia Seeds 500g"`.
2. Expected Result:
   - Status: `UNMATCHED`.
   - System provides recommendation to register as a new product upon bill ingestion.
