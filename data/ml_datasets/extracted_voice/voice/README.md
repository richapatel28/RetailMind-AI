Absolutely. Since these READMEs are for your **actual AIML modules**, I’d make them clear enough for your teammate to set up and for your evaluator to understand the AI pipeline.

You can create these two files:

* `aiml/voice/README.md`
* `aiml/invoice/README.md`

## 1. `voice/README.md`

````markdown
# RetailMind AI – Voice Transaction Module

## 1. Overview

The Voice Transaction Module allows a retailer to record sales and purchase transactions using natural speech instead of manually entering every field.

The system supports:

- English
- Hindi

The retailer can say a transaction such as:

> "Sold 5 Maggi for 300 rupees cash."

The system converts the speech into text and extracts important transaction information such as:

- Transaction type
- Product
- Quantity
- Amount
- Payment mode
- Customer
- Language

The extracted information is validated and returned as structured data that can be consumed by the RetailMind backend.

---

## 2. AI/ML Approach

The module uses a combination of Speech Recognition, Machine Learning and NLP.

### Processing Pipeline

```text
Voice Input
     ↓
Whisper Speech Recognition
     ↓
Transcribed Text
     ↓
Local NLP + ML Models
     ↓
Intent Classification
     ↓
Payment Classification
     ↓
Information Extraction
     ↓
Validation
     ↓
Structured Transaction
````

### Technologies Used

* OpenAI Whisper – Speech-to-Text
* Scikit-learn – Machine Learning
* TF-IDF – Text feature extraction
* Logistic Regression – Classification
* Joblib – Model storage
* Python – NLP processing

No Gemini API is required for the Voice module.

---

## 3. Machine Learning Components

### Intent Classification

The intent model identifies the type of transaction.

Supported intents include:

* Sale
* Purchase
* Return
* Unknown

The model uses:

```text
TF-IDF
   ↓
Logistic Regression
```

Training data is stored in:

```text
data/voice_training.csv
```

The trained model is saved as:

```text
models/intent_model.pkl
```

---

### Payment Classification

The payment model identifies the payment method from the spoken transaction.

Supported payment modes include:

* Cash
* UPI
* Credit
* Unknown

The trained model is saved as:

```text
models/payment_model.pkl
```

The system also handles common English and Hindi variations such as:

* cash
* नकद
* नकदी
* UPI
* online
* credit
* उधार

---

## 4. NLP Information Extraction

After classification, the system extracts transaction information from the transcription.

### Quantity

The system can identify numeric and common number-word expressions.

Example:

```text
"Sold five Maggi"
```

Output:

```text
quantity = 5
```

### Amount

Example:

```text
"for 300 rupees"
```

Output:

```text
amount = 300
```

### Product

The NLP layer removes transaction-related words, numbers, currency terms and other stop words to identify the product.

Example:

```text
"Sold 5 Maggi for 300 rupees cash"
```

Output:

```text
product = Maggi
```

### Customer

The system can identify a customer when included in the sentence.

Example:

```text
"2 Maggi Rahul ko credit pe di"
```

Output:

```text
customer = Rahul
payment_mode = credit
```

---

## 5. Confidence Score

The system generates a confidence score using the outputs of the ML models and the extracted transaction fields.

The score considers:

* Intent classification confidence
* Payment classification confidence
* Product extraction
* Quantity extraction

This helps the system identify transactions that may require user correction.

---

## 6. Validation

Before the transaction is sent to the backend, it is validated.

The validation checks:

* Whether the transaction type is identified
* Whether a product is identified for sales/purchases
* Whether quantity is identified for sales/purchases
* Whether the amount is valid when provided

Example:

```text
Sold Maggi for 300 rupees cash.
```

If quantity is missing:

```json
{
  "valid": false,
  "errors": [
    "Quantity not identified"
  ]
}
```

A transaction such as:

```text
Sold 5 Maggi for 300 rupees cash.
```

can return:

```json
{
  "valid": true,
  "errors": []
}
```

---

# 7. Project Structure

```text
voice/
│
├── data/
│   └── voice_training.csv
│
├── models/
│   ├── intent_model.pkl
│   └── payment_model.pkl
│
├── app.py
├── speech_to_text.py
├── language_detector.py
├── nlp.py
├── validation.py
├── train_model.py
├── requirements.txt
├── README.md
│
├── english.m4a
├── hindi.m4a
│
└── .gitignore
```

---

# 8. Setup

## Step 1 – Navigate to the Voice Module

From the `aiml` directory:

```powershell
cd voice
```

---

## Step 2 – Activate the Virtual Environment

If the project uses the shared virtual environment:

```powershell
..\venv\Scripts\activate
```

---

## Step 3 – Install Dependencies

```powershell
pip install -r requirements.txt
```

The main dependencies are:

```text
openai-whisper
scikit-learn
joblib
```

---

# 9. Train the ML Models

Training data is already provided in:

```text
data/voice_training.csv
```

Run:

```powershell
python train_model.py
```

This creates:

```text
models/intent_model.pkl
models/payment_model.pkl
```

Training should be performed again if the training dataset is modified.

---

# 10. Run Voice Processing

Example:

```powershell
python app.py english.m4a en
```

For Hindi:

```powershell
python app.py hindi.m4a hi
```

The system performs:

```text
Audio
 ↓
Whisper
 ↓
Transcription
 ↓
ML classification
 ↓
NLP extraction
 ↓
Validation
```

---

# 11. Example

### Input

```text
Sold 5 MAGGI for 300 rupees cash.
```

### Output

```text
Intent       : sale
Product      : MAGGI
Quantity     : 5
Amount       : 300
Payment      : cash
Customer     : None
Language     : en
Confidence   : 0.87
Validation   : Valid
```

---

# 12. Important Notes

* The Voice module currently supports English and Hindi.
* Marathi support is planned for future improvement.
* Whisper runs locally and does not require an API key.
* The ML classification models are trained locally using the provided dataset.
* The system does not directly modify the database. It produces structured transaction data that can be passed to the backend API.

````

---

