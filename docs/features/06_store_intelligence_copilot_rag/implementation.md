# Feature 06: Store Intelligence Copilot (Local Multilingual RAG)
## Technical Implementation & Academic Architecture Guide

---

## 1. What is RAG and Why Is It Used Here?
**Retrieval-Augmented Generation (RAG)** is an AI architecture that enhances query answers by retrieving authoritative facts from private external knowledge bases before synthesizing a response.

### Why Standard LLMs / Cloud APIs Are Inappropriate for Kirana Financial Data:
1. **Financial Hallucinations**: Standard language models invent numbers, rates, or suppliers when asked specific ledger questions.
2. **Data Privacy & Compliance**: Kirana store owners cannot upload customer debt ledgers, bank transactions, and purchase invoices to third-party cloud LLM APIs (e.g. OpenAI or Gemini).
3. **No External API Keys**: Running 100% offline with locally hosted neural networks ensures zero ongoing operational costs and complete academic reproducibility.

---

## 2. System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                           Store Intelligence Copilot (RAG)                        |
+-----------------------------------------------------------------------------------+
                                          |
 1. Natural Language Query (en/hi/mr/gu)  |
                                          v
+-----------------------------------------------------------------------------------+
| Node.js Backend API Scoping (/api/ai/copilot/query)                               |
| - Retrieves store documents for req.user.id:                                      |
|   * Supplier Invoices & Item rates (purchases, purchase_items, suppliers)         |
|   * Customer Credit & Udhaar ledgers (sales with CREDIT/PENDING status)           |
|   * Live Product Stock levels (products, inventory_movements)                     |
+-----------------------------------------------------------------------------------+
                                          |
 2. Transmit Query & Store Documents      |
                                          v
+-----------------------------------------------------------------------------------+
| FastAPI AI Service (POST /ai/copilot/query -> rag_service.py)                     |
|                                                                                   |
| Step A: Semantic Document Chunking                                                |
|   - Formats records into rich contextual chunks with metadata tags                |
|                                                                                   |
| Step B: Multilingual Vector Embedding                                             |
|   - Encodes chunks using 'paraphrase-multilingual-MiniLM-L12-v2'                  |
|   - Encodes user query into the same shared dense vector space                    |
|                                                                                   |
| Step C: Dense Cosine Similarity Retrieval                                         |
|   - Computes dot product / cosine similarity between query and all chunks         |
|   - Ranks and extracts top-K relevant chunks with confidence threshold            |
|                                                                                   |
| Step D: Grounded Factual Synthesis (Zero-Hallucination)                           |
|   - Formulates exact factual answer in requested language (en, hi, mr, gu)        |
|   - Cites exact document IDs (Invoice #, Bill #, Date, Rate, Customer)            |
+-----------------------------------------------------------------------------------+
                                          |
 3. Grounded Answer + Source Citations   v
+-----------------------------------------------------------------------------------+
| React Frontend UI (/copilot)                                                      |
| - Displays conversation bubbles                                                   |
| - Renders interactive Grounding Citations accordion with relevance scores        |
| - Supports typing or speaking via native Web Speech API in registered language   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Implementation Files

| File Path | Role | Description |
|---|---|---|
| `ai_service/app/services/rag_service.py` | RAG Engine | Local multilingual document chunker, SentenceTransformer encoder, cosine similarity ranker, and grounded answer synthesizer. |
| `ai_service/app/models/rag_models.py` | Pydantic Models | Defines `RAGQueryRequest`, `RAGSource`, and `RAGQueryResponse`. |
| `ai_service/app/routes/copilot.py` | FastAPI Route | Exposes `POST /ai/copilot/query` with validation and error handling. |
| `backend/src/services/aiService.js` | Backend Client | Axios proxy communicating with FastAPI `/ai/copilot/query`. |
| `backend/src/controllers/aiController.js` | Backend Controller | Scopes queries to authenticated user, fetches purchases, credit sales, products, and logs into `ai_events`. |
| `backend/src/routes/aiRoutes.js` | Express Route | Exposes `POST /api/ai/copilot/query` with JWT authentication middleware. |
| `frontend/src/services/copilotApi.js` | Frontend Service | Axios client invoking backend copilot endpoint. |
| `frontend/src/pages/StoreCopilot.jsx` | Frontend Page | Interactive chat interface with speech input, suggestion chips, and source citations accordion. |
| `frontend/src/i18n/translations.js` | Multilingual Dict | Comprehensive translations for English, Hindi, Marathi, and Gujarati. |
