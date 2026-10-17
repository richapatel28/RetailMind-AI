# Store Intelligence Copilot (Local Multilingual RAG)

## Overview
A 100% private, local Retrieval-Augmented Generation (RAG) system running without cloud LLM dependencies. It grounds answers directly in the retailer's private invoices, customer credit ledgers (Udhaar), inventory stock, and sales history.

## Key Technical Components
1. **Multilingual Embeddings**: `paraphrase-multilingual-MiniLM-L12-v2` (384-dimensional dense vectors) supporting English, Hindi, Gujarati, Marathi.
2. **Cross-Script Transliteration**: Rule-based Indic-to-Latin phonetic converter with consonant-skeleton matching (Soundex-style) so queries in Gujarati script (*"રમેશ પટેલ"*) match records stored in Latin script (*"Ramesh Patel"*).
3. **Structured Table Synthesis**: Instead of unstructured paragraphs, responses for customer credits, supplier rate comparisons, and stock alerts are synthesized into Markdown tables with total summary rows.
4. **Verifiable Citations**: Every answer returns grounded document source citations (`RAGSource`) with reference IDs (bill numbers, invoice IDs) and match percentage confidence.

## Endpoints
* `POST /ai/copilot/query`: Accepts `{ "query": "...", "store_data": {...}, "language": "gu" }` and returns structured table answers with document citations.
