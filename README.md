

---

## 1. What is RetailMind?

Millions of neighborhood grocery stores and small retail shops in India and emerging markets power daily commerce. However, store owners face severe operational bottlenecks:
- **Billing Friction**: Manually barcode-scanning or typing every small item during peak hours causes long customer queues.
- **Inventory & Stock Neglect**: Updating stock from physical paper bills received from distributors takes hours of tedious manual data entry.
- **Financial Blind Spots**: Daily UPI and card payments are hard to cross-verify against bank statements, resulting in untracked cash leakages and unreconciled distributor payments.

**RetailMind AI** solves these pain points with a unified, voice-first and document-intelligent platform tailored specifically for non-technical retailers.

---

## 2. Core Features

### 🎙️ 1. Voice Sales (Hands-Free Spoken Billing)
- Speak customer purchases naturally in **English** or **Hindi** (e.g., *"Sold 2 Maggi for 30 rupees cash"* or *"मैगी के दो पैकेट बेचे 30 रुपये में"*).
- Instant speech-to-text powered by OpenAI Whisper and intent extraction.
- Auto-populates the review form with matched product, quantity, unit price, and total.
- One-tap confirmation commits the sale to PostgreSQL and automatically decrements stock.
- 📖 [Technical Implementation](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/implementation.md) | 🛠️ [Build & Test Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/walkthrough.md)

### 📄 2. Supplier Invoice Intelligence (OCR & Automated Stock Ingestion)
- Photograph or upload printed distributor bills (PDF, JPG, PNG).
- Google Gemini Vision OCR extracts distributor details and line items (product name, quantity, cost price, total).
- **Auto-Restock**: Existing inventory items are refilled with new stock.
- **Auto-Product Creation**: Unrecognized items (e.g. a new soap brand) are automatically created as new catalog products.
- 📖 [Technical Implementation](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/implementation.md) | 🛠️ [Build & Test Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/walkthrough.md)

### 💳 3. Payment Reconciliation (Bank Statement vs Store Records)
- Upload bank statements (CSV or PDF) to cross-verify store sales against bank deposits.
- Multi-factor matching engine evaluates amount, transaction date, and UPI/reference narrations.
- Interactive 4-tab dashboard: **All Transactions**, **Matched Sales**, **Matched Purchases**, and **Needs Review**.
- Clean empty state ensures prior statement sessions never pollute a new upload.
- 📖 [Technical Implementation](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/implementation.md) | 🛠️ [Build & Test Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/walkthrough.md)

### 🔍 4. Smart Product Matching & Inventory Management
- Multi-tier matching pipeline combines exact name search, alias arrays, Levenshtein distance, and phonetic matching.
- Overcomes misspellings and regional terms (e.g. `"maggie"` $\rightarrow$ `Maggi`, `"sofxl"` $\rightarrow$ `Surf Excel`, `"cocacola"` $\rightarrow$ `Coca Cola`).
- Real-time stock alerts trigger when stock drops below designated reorder levels.
- 📖 [Technical Implementation](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/implementation.md) | 🛠️ [Build & Test Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/walkthrough.md)

### 📊 5. Multi-Tenant Store Analytics & Owner Onboarding
- **Strict Multi-Tenancy**: Every KPI (`Today's Sales`, `Profit`, `Transactions`, `Catalog`) is strictly scoped to the logged-in owner (`req.user.id`).
- Brand new shopkeepers start with clean, private dashboards (`₹0 Sales`, `₹0 Profit`).
- **Preferred Language Onboarding**: Choose preferred app language during registration (English, Hindi / हिंदी, Marathi / मराठी, Gujarati / ગુજરાતી, etc.).
- 📖 [Technical Implementation](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/implementation.md) | 🛠️ [Build & Test Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/walkthrough.md)

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Lucide Icons, Axios |
| **Backend API** | Node.js, Express.js, PostgreSQL (`pg` pool), JWT, Bcrypt, Multer |
| **AI / ML Service** | Python 3.10+, FastAPI, Uvicorn, Google Gemini API, Whisper STT, Scikit-learn |
| **Database** | PostgreSQL 15+ (Relational tables, JSONB audit events, GIN alias indexes) |

---

## 4. Project Directory Structure

```
RetailMind/
├── README.md                                  # Primary Project Documentation (This File)
├── frontend/                                  # React 18 + Vite Web Application
│   ├── src/
│   │   ├── components/                        # UI Components (Navbar, Sidebar, Badges, etc.)
│   │   ├── pages/                             # Dashboard, VoiceSale, Invoice, Reconciliation, Register
│   │   ├── services/                          # API clients (voiceApi, invoiceApi, dashboardApi, etc.)
│   │   └── context/                           # AuthContext (JWT session management)
│   ├── package.json
│   └── .env
│
├── backend/                                   # Express REST API Server
│   ├── src/
│   │   ├── controllers/                       # AI, Analytics, Sales, Purchases, Reconciliation
│   │   ├── middleware/                        # JWT Authentication Middleware
│   │   ├── routes/                            # Route Definitions
│   │   └── server.js                          # Express App Entrypoint (:5000)
│   ├── database/                              # PostgreSQL Schema (schema.sql)
│   ├── package.json
│   └── .env
│
├── ai_service/                                # FastAPI AI / ML Microservice
│   ├── app/
│   │   ├── routes/                            # Voice & Invoice endpoints
│   │   ├── services/                          # Gemini Vision OCR & Whisper pipelines
│   │   └── main.py                            # FastAPI App Entrypoint (:8000)
│   ├── requirements.txt
│   └── .env
│
├── data/                                      # Structured Project Data & Samples
│   ├── samples/                               # Test bank statements (PDF & CSV)
│   ├── ml_datasets/                           # Training datasets (invoice.zip, voice.zip)
│   └── archives/                              # Project archives
│
└── docs/                                      # Comprehensive Feature Documentation
    ├── README.md                              # Documentation Matrix
    └── features/                              # Implementation & Walkthrough specs per feature
        ├── 01_voice_sales/
        ├── 02_supplier_invoices/
        ├── 03_payment_reconciliation/
        ├── 04_product_matching/
        └── 05_store_analytics_and_auth/
```

---

## 5. How to Run the Project

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **PostgreSQL** (v14 or higher) running locally on port `5432`

---

### Step 1: Database Setup
1. Open PostgreSQL and create the `retailmind` database:
   ```sql
   CREATE DATABASE retailmind;
   ```
2. Initialize the tables and seed data using the schema file:
   ```bash
   psql -U postgres -d retailmind -f backend/database/schema.sql
   ```

---

### Step 2: Start the AI / ML Microservice (Port 8000)
1. Navigate to the `ai_service` directory:
   ```bash
   cd ai_service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Verify `ai_service/.env` contains your Gemini API key:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=retailmind
   DB_USER=postgres
   DB_PASSWORD=root
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
   *FastAPI will start on `http://127.0.0.1:8000` (API Docs available at `/docs`).*

---

### Step 3: Start the Backend API Server (Port 5000)
1. Open a new terminal and navigate to `backend`:
   ```bash
   cd backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Verify `backend/.env` configuration:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=retailmind
   DB_USER=postgres
   DB_PASSWORD=root
   JWT_SECRET=your_super_secret_jwt_key
   AI_SERVICE_URL=http://localhost:8000
   ```
4. Start the backend server:
   ```bash
   node src/server.js
   ```
   *Backend server will start on `http://localhost:5000`.*

---

### Step 4: Start the Frontend Application (Port 3000)
1. Open a third terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Verify `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
4. Start the Vite development server:
   ```bash
   npm run dev -- --port 3000 --host
   ```
5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 6. Default Test Login Credentials

To quickly test the application without registering a new store:

- **Email:** `owner@test.com`
- **Password:** `password123`

Or click **"Create Store Account"** at `http://localhost:3000/register` to experience the full onboarding flow with your preferred language!

---

## 7. Complete Feature Specifications & Architecture Guides

For detailed engineering designs, database entity relationships, and step-by-step verification walkthroughs, explore the `docs/` folder:

- 📑 [Documentation Index](file:///d:/Capstone_Project/RetailMind/docs/README.md)
- 🎙️ [Voice Sales — Implementation & Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/implementation.md)
- 🎙️ [Voice Sales — Build Guide & Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/01_voice_sales/walkthrough.md)
- 📄 [Supplier Invoices — Implementation & Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/implementation.md)
- 📄 [Supplier Invoices — Build Guide & Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/02_supplier_invoices/walkthrough.md)
- 💳 [Payment Reconciliation — Implementation & Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/implementation.md)
- 💳 [Payment Reconciliation — Build Guide & Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/03_payment_reconciliation/walkthrough.md)
- 🔍 [Product Matching — Implementation & Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/implementation.md)
- 🔍 [Product Matching — Build Guide & Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/04_product_matching/walkthrough.md)
- 📊 [Store Analytics & Auth — Implementation & Architecture](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/implementation.md)
- 📊 [Store Analytics & Auth — Build Guide & Walkthrough](file:///d:/Capstone_Project/RetailMind/docs/features/05_store_analytics_and_auth/walkthrough.md)

# RetailMind-AI
RetailMind AI is an AI-powered retail management platform that streamlines voice-based sales, intelligent invoice processing, inventory management, billing, payment reconciliation, and business insights using machine learning, semantic retrieval, and intelligent automation.

