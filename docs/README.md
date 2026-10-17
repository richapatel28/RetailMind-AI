# RetailMind Engineering Documentation

Welcome to the central technical documentation repository for **RetailMind AI**. 
This folder contains complete architectural specifications, system diagrams, and build walkthroughs for all core platform capabilities.

---

## Documentation Structure

```
docs/
├── README.md                                  # This documentation index
└── features/
    ├── 01_voice_sales/
    │   ├── implementation.md                  # Voice AI Architecture, STT, NLU, Schema, Commit Flow
    │   └── walkthrough.md                     # Building Voice Sales, User Journey & Test Phrases
    ├── 02_supplier_invoices/
    │   ├── implementation.md                  # OCR Architecture, Gemini Vision, Auto-Stock Refill Flow
    │   └── walkthrough.md                     # Building Invoice Extraction, Verification & Bill Ingestion
    ├── 03_payment_reconciliation/
    │   ├── implementation.md                  # Bank Statement Matching Engine, Algorithmic Scoring Flow
    │   └── walkthrough.md                     # Building Reconciliation, Empty State, Discrepancy Review
    ├── 04_product_matching/
    │   ├── implementation.md                  # Fuzzy, Phonetic & Alias Matching Architecture & Flow
    │   └── walkthrough.md                     # Building Product Search, Match Thresholds & Catalog Tests
    └── 05_store_analytics_and_auth/
        ├── implementation.md                  # Multi-Tenancy Architecture, Scoped Analytics, Auth Flow
        └── walkthrough.md                     # Building Dashboard KPIs, Registration & Language Support
```

---

## Feature Documentation Matrix

| Feature | Technical Architecture (`implementation.md`) | Build Guide & Verification (`walkthrough.md`) |
|---|---|---|
| **01. Voice Sales** | [Architecture & Data Flow](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/implementation.md) | [Build Guide & Speech Tests](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/walkthrough.md) |
| **02. Supplier Invoices** | [OCR & Ingestion Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/implementation.md) | [Bill Upload & Auto-Stock Guide](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/walkthrough.md) |
| **03. Payment Reconciliation** | [Matching Engine & Algorithms](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/implementation.md) | [Statement Audit & Empty State Guide](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/walkthrough.md) |
| **04. Smart Product Matching** | [Fuzzy & Phonetic Pipeline](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/implementation.md) | [Catalog Search & Test Cases](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/walkthrough.md) |
| **05. Analytics & Multi-Tenancy** | [Multi-Tenant Data Isolation](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/implementation.md) | [Registration & Dashboard Guide](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/walkthrough.md) |

---

## Quick Navigation
- For instructions on running the entire application (Frontend, Backend, AI service, PostgreSQL), refer to the root [README.md](file:///d:/Capstone_Project/RetailMind/README.md).
