# Feature 04: Smart Product Matching & Catalog Management
## Technical Architecture & Implementation Specification

---

## 1. Problem & Business Objective
In everyday retail, the same product is spoken or written in dozens of different ways:
- *"Maggi"*, *"Maggie"*, *"Magi 2-minute noodles"*, *"मैगी"*
- *"Coca Cola"*, *"Coke"*, *"Cocacola 500ml"*
- *"Surf Excel"*, *"Sofxl"*, *"Surf excel quick wash"*

Standard exact SQL queries (`WHERE name = '...'`) fail 70% of the time on voice inputs and informal supplier invoices.

**Smart Product Matching** provides a multi-layer fuzzy and phonetic matching architecture that matches customer phrases and invoice items against the store inventory catalog with high accuracy, automatically handling phonetic variations, misspellings, and regional names.

---

## 2. Multi-Layer Matching Architecture

```mermaid
flowchart TD
    A[Input Query: Spoken Text / Invoice Description] --> B{Exact Name or Alias Match?}
    B -- Yes --> C[Match Confidence = 100% | Exact]
    B -- No --> D[Normalized Lowercase & Punctuation Strip]
    D --> E[Levenshtein Distance Calculation]
    D --> F[Phonetic / Metaphone Comparison]
    D --> G[Sub-token / Brand Keyword Match]
    E & F & G --> H[Composite Score Aggregation]
    H --> I{Score >= 70%?}
    I -- Yes --> J[Status: MATCHED | Top Candidate Selected]
    I -- No --> K{Score >= 45%?}
    K -- Yes --> L[Status: REVIEW_REQUIRED | Top 3 Candidates Ranked]
    K -- No --> M[Status: UNMATCHED | Flagged as Potential New Product]
```

---

## 3. Data Models & Database Schema

### Products Catalog (`products`)
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    aliases TEXT[] DEFAULT '{}',         -- Synonyms: ['coke', 'cocacola', 'coca-cola']
    unit VARCHAR(50) DEFAULT 'pcs',      -- 'pcs', 'kg', 'ltr', 'pack'
    purchase_price NUMERIC(10,2) DEFAULT 0,
    selling_price NUMERIC(10,2) NOT NULL,
    current_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 5,     -- Low stock threshold
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_aliases ON products USING GIN(aliases);
```

---

## 4. Matching Algorithm Formulation

The composite matching score $S(q, p)$ between an input query $q$ and candidate product $p$ is defined as:

$$S(q, p) = \max \left( S_{\text{name}}(q, p), \; \max_{a \in \text{aliases}(p)} S_{\text{alias}}(q, a) \right)$$

Where the scoring function $S(q, t)$ combines normalized Levenshtein similarity and token overlap:

$$S(q, t) = 0.60 \times \left(1 - \frac{\text{Levenshtein}(q, t)}{\max(|q|, |t|)}\right) + 0.40 \times \text{JaccardTokens}(q, t)$$

### Special Kirana Alias Mapping Rules
Common phonetically ambiguous Kirana terms are registered in the aliases table:
- **`Coca Cola`**: `["coke", "cocacola", "coca-cola", "thums up", "cold drink"]`
- **`Maggi Noodles`**: `["maggie", "magi", "noodles", "instant noodles"]`
- **`Surf Excel`**: `["sofxl", "surf", "surf excel detergent"]`
- **`Parle-G`**: `["parle g", "parle", "biscuit", "parleg"]`

---

## 5. API Specification

### Endpoint: Match Spoken / Written Product
- **Path**: `POST /api/ai/product-match`
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "query": "2 sofxl pack",
    "threshold": 0.60
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "query": "2 sofxl pack",
    "status": "MATCHED",
    "confidence": 0.88,
    "matched_product": {
      "id": 4,
      "name": "Surf Excel Detergent 500g",
      "sku": "SURF-500G",
      "selling_price": 70.00,
      "current_stock": 28
    },
    "candidates": [
      { "id": 4, "name": "Surf Excel Detergent 500g", "score": 88 },
      { "id": 9, "name": "Ariel Detergent 500g", "score": 52 }
    ]
  }
  ```

---

## 6. Catalog Management & Inventory Health
- **Live Stock Audits**: Every sale decrements stock; every invoice purchase refills stock.
- **Low Stock Alerts**: Real-time KPI triggers when `current_stock <= reorder_level` so the retailer never runs out of best-selling inventory.
