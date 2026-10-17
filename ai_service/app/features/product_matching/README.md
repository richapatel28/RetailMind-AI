# Product Matching Feature (Semantic & Fuzzy Resolution)

## Overview
The **Product Matching** module resolves noisy, abbreviated, or misspelled item descriptions extracted from supplier invoices or customer voice orders against the store's canonical product catalog.

## Pipeline Architecture
1. **Normalization**: `text_normalizer.py` cleans text, strips punctuation, and normalizes Indic Unicode ranges.
2. **Exact Matching**: Checks canonical name, SKU, and predefined aliases.
3. **Fuzzy String Matching**: Uses Levenshtein distance ratio (`rapidfuzz.fuzz.ratio`) weighted at **60%**.
4. **Dense Semantic Matching**: Encodes strings into 384-dimensional dense vectors using `paraphrase-multilingual-MiniLM-L12-v2` and computes **Cosine Similarity** weighted at **40%**.
5. **Ensemble Scoring**:
   $$\text{Confidence} = 0.6 \times \text{FuzzyScore} + 0.4 \times \text{SemanticScore}$$
6. **Decision Boundaries**:
   - $\ge 0.85$: `MATCHED` (Auto-linked)
   - $0.60 - 0.84$: `REVIEW_REQUIRED` (Suggested to user)
   - $< 0.60$: `NO_MATCH`

## Endpoints
* `POST /ai/product/match`: Accepts `{ "product_name": "..." }` and returns top 3 ranked candidates.
