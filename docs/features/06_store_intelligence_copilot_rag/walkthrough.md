# Feature 06: Store Intelligence Copilot (Local Multilingual RAG)
## Step-by-Step Walkthrough, Test Verification & Viva Defense Guide

---

## 1. Step-by-Step Feature Walkthrough

### Step 1: Navigating to Store Copilot
1. Open the sidebar navigation and click **Store Copilot (RAG)** (`/copilot`).
2. Notice the top banner confirming:
   - **"100% Private Local RAG • Zero Cloud LLM Reliance"**
3. Notice the **Suggested Questions** pills customized to the shopkeeper's active language.

### Step 2: Asking Questions (Typed or Spoken)
1. You can type any question or click the **Microphone** icon to speak in your language (English, Hindi, Marathi, or Gujarati).
2. Example questions:
   - *"Which supplier gave the lowest price for Maggi?"*
   - *"मैगी किस सप्लायर से सबसे सस्ती मिली?"* (Hindi)
   - *"મેગી કયા સપ્લાયર પાસેથી સૌથી સસ્તી મળી?"* (Gujarati)
   - *"मॅगी कोणत्या पुरवठादाराकडून सर्वात स्वस्त मिळाली?"* (Marathi)
   - *"Who owes us customer credit (Udhaar)?"*
   - *"Which products are running low in stock?"*

### Step 3: Inspecting Grounded Answers & Source Citations
1. The Copilot returns a clear, direct answer in your language citing exact invoice numbers, rates, and dates.
2. Below the answer, click **Grounded Document Sources**:
   - Expands to show the exact source records retrieved from your database!
   - Shows **Document Type** (Supplier Invoice, Credit Ledger, Inventory, Sale Record).
   - Shows **Reference ID** (e.g. `INV-2026-089`, `BILL-20260907-0014`).
   - Displays the exact database text chunk and semantic **Relevance Match %**!

---

## 2. Test Verification & Results

All 4 languages were verified through direct execution of the multilingual RAG engine:

```
=== TESTING LOCAL MULTILINGUAL RAG PIPELINE ===

[Test 1 - English Supplier Rate]
Query: Which supplier gave the lowest price for Maggi?
Answer: Based on verified invoice records, Metro Cash & Carry provided the lowest purchase price for Maggi at ₹10.00 per unit (Invoice #INV-2026-089, Date: 2026-09-01).
Confidence: 0.5896
Sources cited: 4 (Top source: INVENTORY PROD-1)

[Test 2 - Gujarati Supplier Rate]
Query: મેગી કયા સપ્લાયર પાસેથી સૌથી સસ્તી મળી?
Answer: ચકાસાયેલ ઇનવોઇસ રેકોર્ડ્સ મુજબ, Metro Cash & Carry એ Maggi માટે સૌથી ઓછો ખરીદ ભાવ ₹10.00 પ્રતિ યુનિટ આપ્યો (ઇનવોઇસ #INV-2026-089, તારીખ: 2026-09-01).
Confidence: 0.5564

[Test 3 - Hindi Customer Credit]
Query: रमेश का कितना उधार बाकी है?
Answer: ग्राहक Ramesh Kumar का बिल #BILL-20260907-0014 (दिनांक: 2026-09-07) पर ₹45.00 का बकाया उधार है।
Confidence: 0.5918

[Test 4 - Marathi Low Stock]
Query: कोणत्या उत्पादनांचा साठा कमी आहे?
Answer: खालील उत्पादनांचा साठा कमी आहे: Dettol Soap 100g.
Confidence: 0.4175

=== ALL 4 MULTILINGUAL RAG TESTS PASSED 100%! ===
```

---

## 3. Viva / Professor Q&A Defense

**Q1. Professor: "What model is used for RAG and where does it run?"**
> **Answer**: We use the pre-trained neural embedding model `paraphrase-multilingual-MiniLM-L12-v2` from Sentence-Transformers. It runs 100% locally and offline inside our FastAPI Python microservice. It maps multilingual text (English, Hindi, Marathi, Gujarati) into a dense 384-dimensional semantic vector space.

**Q2. Professor: "Why didn't you just use OpenAI or Gemini API?"**
> **Answer**: Three critical reasons:
> 1. **Data Privacy**: Small retail businesses have confidential supplier wholesale pricing and customer debt (Udhaar) records that must not be leaked to public cloud APIs.
> 2. **Zero Financial Hallucination**: Cloud LLMs frequently fabricate financial figures. Our local RAG performs strict deterministic entity extraction and semantic similarity retrieval grounded in genuine database rows.
> 3. **Cost & Offline Viability**: Small enterprise software must remain operational without ongoing per-token API billing or Internet downtime.

**Q3. Professor: "How does the system handle Gujarati and Hindi when the database has English names?"**
> **Answer**: Because `paraphrase-multilingual-MiniLM-L12-v2` was trained on massive parallel multilingual corpora across 50+ languages, sentences with equivalent semantic concepts in Gujarati (`સૌથી સસ્તી`), Hindi (`सबसे सस्ती`), and English (`lowest price`) map to adjacent points in the vector space, enabling seamless cross-lingual retrieval.
