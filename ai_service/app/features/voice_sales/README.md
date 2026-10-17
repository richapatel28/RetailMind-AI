# Voice Sales — Feature Documentation

## Overview
Converts spoken or typed sales commands into structured order data.  
Supports **English, Hindi, Gujarati, Marathi** using:
- **OpenAI Whisper** (local, offline) for audio transcription
- **TF-IDF + Logistic Regression** (scikit-learn) for intent & payment classification
- **Regex + keyword rules** for product/quantity extraction

---

## Folder Structure
```
voice_sales/
├── models.py              # Pydantic request/response schemas
├── service.py             # Core parsing pipeline
├── router.py              # FastAPI endpoints
├── __init__.py
├── ml_assets/
│   ├── intent_model.pkl   # Trained intent classifier
│   └── payment_model.pkl  # Trained payment-type classifier
├── training/
│   ├── train_models.py    # Training script
│   └── evaluation_report.json
├── dataset/
│   └── voice_training.csv # 147 labelled samples (4 languages)
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/voice/parse` | Upload audio file → parse |
| POST | `/ai/voice/parse-text` | Send text string → parse |

---

## ML Pipeline

### Training Data
- **File**: `dataset/voice_training.csv`
- **Samples**: 147 labelled utterances
- **Languages**: English (en), Hindi (hi), Gujarati (gu), Marathi (mr)
- **Columns**: `text, intent, payment_type, language`

### Model Architecture

```
TfidfVectorizer(ngram_range=(1,2), sublinear_tf=True)
       +
LogisticRegression(C=2.5, max_iter=1000)
       = sklearn Pipeline (saved via joblib)
```

Two separate models are trained:

| Model | Labels | Test Accuracy | CV Accuracy |
|-------|--------|--------------|-------------|
| `intent_model.pkl` | sell, buy, stock_check, credit, payment | 70% | 78.7% |
| `payment_model.pkl` | cash, credit, upi, unknown | 80% | 82.1% |

### Training
```bash
python training/train_models.py
```

### Inference Pipeline
1. Whisper transcribes audio → raw text  
2. TF-IDF vectorises text  
3. Intent model predicts intent class  
4. Payment model predicts payment type  
5. Regex rules extract product name + quantity  
6. `product_matching` feature resolves product against catalog  
7. Structured `VoiceParseResponse` returned

---

## Technique Used
**Classification** — multiclass text classification using:
- `TfidfVectorizer` (feature extraction)  
- `LogisticRegression` (discriminative classifier)

**No deep learning / LLM** — fully local, offline, fast.

---

## Example Request
```json
POST /ai/voice/parse-text
{
  "text": "bhai do kilo atta aur ek namak dena, UPI se dunga",
  "language": "hi"
}
```

### Example Response
```json
{
  "intent": "sell",
  "payment_type": "upi",
  "products": [
    { "name": "Atta", "quantity": 2, "unit": "kg" },
    { "name": "Namak", "quantity": 1, "unit": null }
  ],
  "language_detected": "hi",
  "confidence": 0.87
}
```
