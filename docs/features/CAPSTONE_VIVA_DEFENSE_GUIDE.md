# RetailMind AI: Capstone Project Defense & Viva Guide
## Complete Academic & Engineering Master Reference for Professor Review

---

## 1. Project Abstract & High-Level Architecture

**RetailMind AI** is an intelligent, offline-capable enterprise automation platform designed specifically for small Indian retail enterprises (Kirana stores).
The platform addresses three core retail challenges:
1. **Frictionless Point-of-Sale**: Multilingual voice sales that process compound multi-product transactions in regional languages (**English, Hindi, Marathi, and Gujarati**) without requiring manual entry or literacy in English.
2. **Private Factual Store Intelligence (Local RAG)**: Answers operational questions about supplier wholesale rates, customer credit ledgers (Udhaar), and stock depletion grounded strictly in private store records with **zero financial hallucinations and zero cloud LLM reliance**.
3. **Autonomous Operational Efficiency (Agentic AI)**: An autonomous Operations Agent utilizing a **ReAct (Reasoning + Acting)** loop to proactively detect inventory shortages, find cheapest historical suppliers, and generate restock purchase orders within a strict **Human-in-the-Loop confirmation boundary**.

### High-Level Architectural Layers:
```
+-----------------------------------------------------------------------------------+
| 1. PRESENTATION LAYER (React 18 + Vite + Tailwind CSS + Web Speech API)           |
|    - 100% Localized in English, Hindi, Marathi, Gujarati                          |
|    - Dashboard, Multilingual Voice POS, Sales & Printable Bills, Store Copilot,   |
|      ReAct Operations Agent, Supplier Invoices, Reconciliation, Products & Stock  |
+-----------------------------------------------------------------------------------+
                                         |
                            JWT Secured RESTful APIs
                                         v
+-----------------------------------------------------------------------------------+
| 2. APPLICATION CONTROLLER LAYER (Node.js + Express + pg connection pool)          |
|    - Multi-Tenant Row-Level Isolation (WHERE user_id = $1)                        |
|    - Strict ACID Financial Transactions (BEGIN ... FOR UPDATE ... COMMIT)         |
|    - Deterministic Bill Generation (BILL-YYYYMMDD-XXXX)                           |
+-----------------------------------------------------------------------------------+
                                         |
                            Local IPC / Internal Network
                                         v
+-----------------------------------------------------------------------------------+
| 3. ARTIFICIAL INTELLIGENCE MICROSERVICE (Python 3.11 + FastAPI + Scikit-Learn)    |
|    - Speech-to-Text: Local OpenAI Whisper model with imageio-ffmpeg               |
|    - Genuine ML Models: TF-IDF + Logistic Regression (intent_model & payment_model)|
|    - Local RAG Engine: paraphrase-multilingual-MiniLM-L12-v2 + Cosine Similarity  |
|    - Autonomous Agent: ReAct Reasoning Loop (Thought -> Tool -> Observation)     |
+-----------------------------------------------------------------------------------+
                                         |
                            Raw SQL Relations & Indexes
                                         v
+-----------------------------------------------------------------------------------+
| 4. DATABASE & PERSISTENCE LAYER (PostgreSQL)                                      |
|    - users, products, sales, sale_items, purchases, purchase_items,               |
|      suppliers, customers, payments, inventory_movements, ai_events               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Deep Dive: The 7 Core Features Implemented

### Feature 1: Complete Multilingual SaaS Website
- **Supported Languages**: English (`en`), Hindi (`hi`), Marathi (`mr`), Gujarati (`gu`).
- **Implementation**: Comprehensive i18n dictionaries in `frontend/src/i18n/translations.js`.
- **Pages Localized**: Dashboard, Voice POS, Sales & Bills, Supplier Invoices, Payment Reconciliation, Product Matching, Products & Stock, Store Copilot, Operations Agent, Login, Register.
- **Academic Merit**: Real-world Kirana merchants across Western and Northern India operate predominantly in regional mother tongues; complete UI localization bridges digital divide.

### Feature 2: Multilingual Multi-Product Voice Sales
- **Spoken Input**: Handles conjunction clauses (e.g. Gujarati: *"૨ મેગી અને ૧ કોકા કોલા ૩૦ રૂપિયા રોકડ"*).
- **Indic Script Normalization**: Converts Indic numeral digits (`૦-૯`, `०-९`) into standard numerical quantities.
- **Language Lock**: Speech recognition is locked strictly to the user's registered mother tongue to prevent misrecognition.
- **Detected Items Basket Table**: Allows shopkeepers to review recognized items, adjust quantities or unit rates, remove lines, or add items before confirmation.

### Feature 3: Automatic Deterministic Bill Generation
- **Unique Format**: `BILL-YYYYMMDD-XXXX` (e.g., `BILL-20260908-0018`).
- **ACID Guarantee**: Generated inside PostgreSQL database transactions with row-level locks (`FOR UPDATE`).
- **Official Bill Receipt Card**: Renders detailed tax invoice receipt with shopkeeper name, date, itemized table, rates, grand total, and browser printing (`window.print()`).
- **Sales & Bills Page (`/sales`)**: Complete historical ledger allowing filtering by source (Voice vs Manual), status (Paid vs Credit), and viewing/reprinting past bills.

### Feature 4: Product Catalog & Inventory Movement Auditing
- **Stock Tracking**: Every confirmed sale or supplier purchase atomically increments or decrements product stock.
- **Immutable Ledger**: Every stock change writes a corresponding record to `inventory_movements` (`movement_type`: `SALE`, `INVOICE`, `AGENT_RESTOCK`).
- **Multi-Tenant Isolation**: Every SQL query filters strictly by `user_id`, guaranteeing that one store's stock, prices, and debts are never visible to another store.

### Feature 5: Genuine Local RAG (Store Intelligence Copilot)
- **Concept**: Retrieval-Augmented Generation running 100% locally on the store server.
- **Embedding Model**: `paraphrase-multilingual-MiniLM-L12-v2` from Sentence-Transformers (maps text into a 384-dimensional semantic space).
- **Knowledge Sources**: Private supplier invoices, customer credit ledgers (Udhaar), sales logs, and inventory.
- **Zero Financial Hallucination**: Every answer is grounded directly in database rows and cites exact invoice numbers, dates, customer names, and unit prices.

### Feature 6: Genuine Machine Learning Model Training Pipeline
- **Dataset**: 147 verified regional retail expressions across English, Hindi, Marathi, and Gujarati in `ai_service/training/data/voice_training.csv`.
- **Training Script**: `ai_service/training/train_models.py`.
- **Architecture**: Sublinear TF-IDF Vectorizer + Multinomial Logistic Regression ($L_2$ regularized).
- **Evaluation**: 80/20 Stratified Train/Test Split + 5-Fold Cross Validation.
- **Empirical Results**:
  - Intent Model: 70.00% Test Accuracy, 5-Fold CV: $78.70% pm 4.38%$.
  - Payment Model: 80.00% Test Accuracy, 88.62% Precision, 5-Fold CV: $82.07% pm 3.12%$.
  - Generates confusion matrix and exports `evaluation_report.json`.

### Feature 7: Autonomous Operations Agent (ReAct Reasoning Loop)
- **Reasoning Paradigm**:
  $$\text{Thought} \rightarrow \text{Action (Tool Invocation)} \rightarrow \text{Observation} \dots \rightarrow \text{Proposed Plan}$$
- **Restricted Tools**:
  - `tool_detect_inventory_shortages(threshold=15)`
  - `tool_find_cheapest_supplier(product_name)`
  - `tool_calculate_economic_reorder(current_stock)`
  - `tool_audit_customer_credit(min_amount)`
- **Human-in-the-Loop Safe Execution Boundary**: The agent proposes structured purchase orders or recovery reminders; changes are only committed when the merchant clicks **"Approve & Execute"**.

---

## 3. Professor / External Examiner Viva Q&A Cheat Sheet

### Category A: Machine Learning & Training
**Q1: "Did you build your own model, or did you just call an API?"**
> **Answer**: "We built and trained our own genuine Machine Learning models using Scikit-Learn pipelines. Our training script (`ai_service/training/train_models.py`) loads our custom 4-language dataset (`voice_training.csv`), performs an 80/20 stratified train/test split, executes 5-fold cross validation, and serializes the fitted weights into `intent_model.pkl` and `payment_model.pkl`. All inference runs offline on our local Python server."

**Q2: "What loss function and optimizer does your classification model use?"**
> **Answer**: "We use Multinomial Logistic Regression with Softmax cross-entropy loss, minimized via the L-BFGS (Limited-memory Broyden-Fletcher-Goldfarb-Shanno) quasi-Newton optimization algorithm with $L_2$ weight regularization ($C=2.5$). For feature representation, we use Sublinear TF-IDF with unigram and bigram n-gram ranges."

**Q3: "Why did you use TF-IDF + Logistic Regression instead of fine-tuning BERT for classification?"**
> **Answer**: "In real-world retail store edge servers and laptops, inference speed and RAM efficiency are paramount. TF-IDF + Logistic Regression yields sub-5 millisecond response times and negligible memory overhead while delivering 80% test accuracy. For heavy cross-lingual semantic search, we separately leverage our local Sentence-Transformers model."

---

### Category B: Retrieval-Augmented Generation (RAG)
**Q4: "Where is RAG used in this project and why?"**
> **Answer**: "RAG is implemented in Feature 06: Store Intelligence Copilot (`/copilot`). It allows the storekeeper to query confidential store documents (supplier bills, customer credit books, inventory levels) in English, Hindi, Marathi, or Gujarati. We chunk the store's private database records, generate dense vector embeddings locally using `paraphrase-multilingual-MiniLM-L12-v2`, compute cosine similarity against the query embedding, and formulate a factual, zero-hallucination response citing exact source documents."

**Q5: "Why didn't you use OpenAI or Gemini API for RAG?"**
> **Answer**: "For three critical engineering and academic reasons:
> 1. **Data Privacy**: Kirana merchants cannot transmit customer debt registers and supplier wholesale discounts to public cloud LLM servers.
> 2. **Financial Hallucination Risk**: Commercial LLMs frequently hallucinate numbers and rates. Our local RAG enforces deterministic entity extraction grounded in real database rows.
> 3. **Zero Operational Cost & Offline Resilience**: A retail store system must continue working even when Internet connectivity fluctuates."

---

### Category C: Agentic AI & Autonomous Operations
**Q6: "What is the difference between your Agent and your RAG Copilot?"**
> **Answer**: "Our RAG Copilot is **informative** (answers user questions about past records). Our Operations Agent is **action-oriented and autonomous**. It pursues operational goals (e.g. optimizing inventory replenishment), executes a multi-step **ReAct (Reasoning + Acting)** cycle, calls restricted database tools, calculates economic order quantities, and generates structured purchase orders requiring explicit human merchant approval."

**Q7: "Why do you have a Human-in-the-Loop confirmation boundary?"**
> **Answer**: "In financial and enterprise automation, fully unchecked agentic execution is dangerous—an AI could mistakenly double-order inventory or trigger unauthorized supplier payments. The human-in-the-loop boundary ensures that the agent handles 95% of tedious analytical calculations while preserving merchant accountability and legal control."

---

### Category D: Database & Software Engineering
**Q8: "How do you guarantee database consistency during high-speed voice sales?"**
> **Answer**: "All sale confirmations execute inside atomic PostgreSQL transactions (`BEGIN ... COMMIT`). When stock is decremented, we acquire row-level locks using `SELECT ... FOR UPDATE` to prevent race conditions or negative inventory. If any product has insufficient stock, the entire transaction rolls back cleanly (`ROLLBACK`)."

**Q9: "How does the system ensure multi-tenant data isolation?"**
> **Answer**: "Every database table (`products`, `sales`, `purchases`, `customers`, `ai_events`) includes a foreign key column `user_id` linked to the authenticated store owner. Every SQL query in Node.js explicitly enforces `WHERE user_id = $1` extracted from the verified JWT bearer token."
