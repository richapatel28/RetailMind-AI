# Feature 05: Store Analytics, Multi-Tenancy & Authentication
## Step-by-Step Build Guide & Feature Walkthrough

---

## 1. How This Feature Was Built

### Step 1: Diagnosing & Eliminating the Multi-Tenancy Leak
- **The Issue**: When a new user (e.g. `Nia Sharma`) created an account and opened the dashboard, she was greeted with:
  `Today's Sales: ₹246 | Profit: ₹90`
  even though she had never recorded a single transaction.
- **Root Cause**: `backend/src/controllers/analyticsController.js` queried `sales` and `sale_items` across the entire database without a `WHERE user_id = $1` clause.
- **The Solution**:
  - Bound all analytics queries to `req.user.id`.
  - Used subquery joins for `sale_items` to ensure that only the authenticated user's sales are summed per product.
  - Tested that brand new shopkeepers cleanly see `₹0 Sales` and `₹0 Profit`.

### Step 2: Preferred Language Selection on Sign-up
- In `frontend/src/pages/Register.jsx`:
  - Added **"Preferred Language (पसंदीदा भाषा) *"** directly on **Step 1** (Account Details), ensuring it is immediately visible to registering retailers.
  - Included native script labels:
    - English
    - Hindi (हिंदी)
    - Marathi (मराठी)
    - Gujarati (ગુજરાતી)
    - Tamil (தமிழ்)
    - Telugu (తెలుగు)
    - Bengali (বাংলা)
    - Kannada (ಕನ್ನಡ)
    - Punjabi (ਪੰਜਾਬੀ)
  - Synchronized choice with Step 3 preferences and saved to `users.language` and `users.voice_language`.

### Step 3: Real-Time Dashboard KPI Cards
- In `frontend/src/pages/Dashboard.jsx`:
  - **Card 1 (Today's Sales & Profit)**: Live sales volume and net margin computed dynamically.
  - **Card 2 (Inventory Health)**: Active products count with automated low-stock alert badges.
  - **Card 3 (Automation Status)**: Live indicator confirming Voice Sales, Invoice OCR, and Reconciliation are active.
  - **Quick Action Hub**: Instant navigation to Voice Sale, Invoice, and Payment Reconciliation.
  - **Recent Activity Table**: Shows only the retailer's 5 most recent transactions with live timestamping.

---

## 2. End-to-End User Journey

```
[New Shopkeeper opens Registration Page]
                       │
                       ▼
[Fills Step 1: Name, Email, Phone, Preferred Language: "Hindi (हिंदी)", Password]
                       │
                       ▼
[Fills Step 2: Store Name: "Aarav Daily Kirana", Location: "Ahmedabad"]
                       │
                       ▼
[Fills Step 3: Confirms Voice Assistant Language: Hindi & taps "Complete Setup"]
                       │
                       ▼
[Account created in PostgreSQL! Auto-authenticated with JWT]
                       │
                       ▼
[Lands on Dashboard: Clean, isolated state]
  ├── Today's Sales: ₹0
  ├── Profit: ₹0
  ├── Transactions: 0
  └── "No sales recorded today yet"
                       │
                       ▼
[Records first sale via Voice -> Dashboard updates immediately to reflect ₹30 sales!]
```

---

## 3. Test Cases & Verification

### Test Case 1: Multi-Tenancy Isolation Test
1. Query dashboard for newly registered user (e.g. User 8 `nia@gmail.com` or User 10 `aarav@example.com`).
2. Verify:
   ```json
   {
     "today_sales": 0,
     "today_transactions": 0,
     "today_profit": 0,
     "today_expenses": 0
   }
   ```
3. Query dashboard for existing test user (`owner@test.com`):
   - Sales: `₹246`
   - Profit: `₹90`
   - Verified that user records are completely isolated and private.

### Test Case 2: Registration with Preferred Language
1. Open `/register` in the browser.
2. Step 1 clearly presents the language dropdown with native scripts.
3. Select `"Hindi (हिंदी)"` and complete registration.
4. Verify in PostgreSQL `users` table:
   - `language` column is saved as `'Hindi'`.
   - `voice_language` column is saved as `'Hindi'`.

### Test Case 3: JWT Authentication & Session Persistence
1. Register or log in with `owner@test.com` / `password123`.
2. Inspect `localStorage`:
   - `retailmind_token`: Contains valid signed JWT.
   - `retailmind_user`: Contains user profile JSON.
3. Refresh the page: User remains logged in without re-entering credentials.

### Test Case 4: 4-Language Localization & Switching Test
1. Log in to RetailMind dashboard.
2. In the top navigation bar, click the **Language Selector** (`🌐 🇬🇧 English`).
3. Select **`🇮🇳 मराठी (Marathi)`**:
   - Navigation links immediately switch: *डॅशबोर्ड*, *व्हॉइस विक्री*, *पुरवठादार बिले*, *बँक सामंजस्य*, *उत्पादन जुळणी*, *इन्व्हेंटरी / साठा*.
   - KPI cards switch: *एकूण महसूल / विक्री*, *एकूण नफा (Profit)*, *कमी साठा सूचना*.
   - Browser stores `retailmind_language: "mr"` in `localStorage`.
   - Backend receives `PUT /api/auth/language` with `{ "language": "mr" }` and updates PostgreSQL `users.language = 'mr'`.
4. Select **`🇮🇳 ગુજરાતી (Gujarati)`**:
   - Navigation links switch: *ડેશબોર્ડ*, *અવાજ વેચાણ*, *સપ્લાયર ઇનવોઇસ*, *બેંક સમાધાન*, *પ્રોડક્ટ મેચિંગ*, *ઇન્વેન્ટરી / સ્ટોક*.
   - KPI cards switch: *કુલ આવક / વેચાણ*, *કુલ નફો (Gross Profit)*, *ઓછા સ્ટોકની ચેતવણી*.
   - Database and localStorage update cleanly to `"gu"`.
5. Select **`🇮🇳 हिन्दी (Hindi)`**:
   - Navigation links switch: *डैशबोर्ड*, *वॉयस बिक्री*, *सप्लायर बिल*, *बैंक समाधान*, *उत्पाद मिलान*, *स्टॉक / इन्वेंटरी*.
   - KPI cards switch: *कुल बिक्री (Revenue)*, *सकल मुनाफा (Profit)*, *कम स्टॉक सूचना*.
6. Press browser Refresh (F5):
   - Active language is seamlessly restored from `localStorage` without resetting to English.

### Test Case 5: Full Application Page-by-Page Localization & Voice Language Lock
1. **Voice Sale Page (`VoiceSale.jsx`)**:
   - Manual toggle pills removed; voice analysis is locked strictly to user's registered profile language (`language` from `useLanguage()`).
   - Displays profile-bound active language badge (e.g. *પસંદ કરેલ ભાષા: 🇮🇳 ગુજરાતી (Gujarati)*).
   - Dynamic quick-test phrases appear in the active language (Gujarati: *૨ મેગી ૩૦ રૂપિયા રોકડ*, Marathi: *२ मॅगी ३० रुपये रोख*, Hindi: *मैगी २ पैकेट ३० रुपये*, English: *3 Maggie Rs 45 cash*).
   - Mic buttons, recording prompts, low confidence alerts, editable fields, and confirm sale buttons are completely translated.
2. **Supplier Invoices Page (`Invoice.jsx`)**:
   - Option A (*Enter Invoice Manually* / *મેન્યુઅલ બિલ એન્ટ્રી* / *हाथ से बिल दर्ज करें*), Option B (*Upload Invoice* / *ઇનવોઇસ અપલોડ કરો* / *बिल अपलोड करें*), table headers, and success receipts are fully translated.
3. **Bank Reconciliation Page (`Reconciliation.jsx`)**:
   - Spreadsheet / Document upload cards, empty states, Financial Overview (*Monthly* / *Yearly*), KPI cards, and reconciliation activity tables are completely localized.
4. **Product Matching Page (`ProductMatching.jsx`)**:
   - Search bar, candidate rankings, confidence meters, and match badges are fully localized.
5. **Registration Flow (`Register.jsx`)**:
   - Language dropdown is restricted to English, Hindi, Marathi, and Gujarati. Selecting a language automatically binds the shopkeeper's voice sale language.

