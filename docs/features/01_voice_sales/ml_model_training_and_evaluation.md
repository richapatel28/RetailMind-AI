# Machine Learning Model Training & Academic Evaluation Pipeline
## Reproducible NLP Classification for Multilingual Voice Sales

---

## 1. Overview for Professor & External Examiners

This document details the genuine Machine Learning pipeline developed and trained for **RetailMind AI**.
Unlike superficial systems that rely solely on external cloud APIs, RetailMind AI features its own end-to-end NLP classification pipelines trained on genuine multilingual retail voice data in **English, Hindi, Marathi, and Gujarati**.

### Models Trained:
1. **Voice Intent Classifier** (`intent_model.pkl`):
   - **Task**: Classifies incoming transcribed retail speech into operational intents: `sale`, `purchase`, or `return`.
   - **Pipeline**: N-gram TF-IDF Vectorizer + Multinomial Logistic Regression.
2. **Payment Mode Classifier** (`payment_model.pkl`):
   - **Task**: Detects payment transaction modality: `cash` (રોકડ / नकद / रोख), `upi` (QR code / PhonePe / GPay), `credit` (Udhaar / ઉધાર / उधार), or `unknown`.
   - **Pipeline**: Sublinear TF-IDF Vectorizer + Multinomial Logistic Regression.

---

## 2. Mathematical Formulation & Architecture

### Step 1: Sublinear Term Frequency - Inverse Document Frequency (TF-IDF)
For each token $t$ in utterance $d$ from corpus $D$:
$$	ext{TF}(t, d) = 1 + ln(	ext{count}(t, d)) quad 	ext{if } 	ext{count}(t, d) > 0$$
$$	ext{IDF}(t, D) = lnleft( rac{1 + |D|}{1 + |{d in D : t in d}|} ight) + 1$$
$$	ext{TF-IDF}(t, d, D) = 	ext{TF}(t, d) 	imes 	ext{IDF}(t, D)$$
Feature extraction captures both unigrams and bigrams ($n in {1, 2}$) to model compound retail phrases like *"नकद में"*, *"रोકડ વેચી"*, and *"on credit"*.

### Step 2: Softmax Multinomial Logistic Regression
Given feature vector $mathbf{x} in mathbb{R}^V$, the probability of class $k$ is given by:
$$P(Y = k mid mathbf{x}) = rac{e^{mathbf{w}_k^T mathbf{x} + b_k}}{sum_{j=1}^K e^{mathbf{w}_j^T mathbf{x} + b_j}}$$
Loss function minimized with $L_2$ regularization:
$$mathcal{L}(mathbf{W}) = -sum_{i=1}^N sum_{k=1}^K y_{ik} ln P(Y_i = k mid mathbf{x}_i) + rac{1}{2C} sum_{k=1}^K |mathbf{w}_k|_2^2$$

---

## 3. Dataset & Stratified Train/Test Split

- **Dataset Path**: `ai_service/training/data/voice_training.csv`
- **Total Samples**: 147 verified regional retail expressions across 4 languages.
- **Languages**: English, Hindi (Hinglish + Devanagari), Marathi, Gujarati.
- **Split Ratio**: 80% Training Set ($N=117$), 20% Unseen Test Set ($N=30$).
- **Validation Method**: Stratified 5-Fold Cross-Validation on the training partition.

---

## 4. Empirical Evaluation Results

### Model 1: Voice Intent Classifier
- **5-Fold Cross-Validation Accuracy**: $78.70% pm 4.38%$
- **Test Set Accuracy**: **70.00%**
- **Macro Precision**: 65.28% | **Macro Recall**: 52.43% | **Weighted F1**: 66.06%

#### Classification Report:
| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **purchase** | 0.75 | 0.43 | 0.55 | 7 |
| **return** | 0.50 | 0.20 | 0.29 | 5 |
| **sale** | 0.71 | 0.94 | 0.81 | 18 |
| **Average / Total** | **0.68** | **0.70** | **0.66** | **30** |

#### Confusion Matrix:
```
Predicted ->  purchase  return  sale
purchase  |    3       0       4
return    |    1       1       3
sale      |    0       1      17
```

---

### Model 2: Payment Mode Classifier
- **5-Fold Cross-Validation Accuracy**: $82.07% pm 3.12%$
- **Test Set Accuracy**: **80.00%**
- **Macro Precision**: 88.62% | **Macro Recall**: 76.67% | **Weighted F1**: 80.08%

#### Classification Report:
| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **cash** | 0.86 | 0.75 | 0.80 | 8 |
| **credit (Udhaar)** | 1.00 | 0.60 | 0.75 | 5 |
| **unknown** | 0.69 | 0.92 | 0.79 | 12 |
| **upi** | 1.00 | 0.80 | 0.89 | 5 |
| **Average / Total** | **0.84** | **0.80** | **0.80** | **30** |

#### Confusion Matrix:
```
Predicted ->  cash  credit  unknown  upi
cash      |    6      0        2      0
credit    |    0      3        2      0
unknown   |    1      0       11      0
upi       |    0      0        1      4
```

---

## 5. Reproduction Instructions

To retrain the models and regenerate the evaluation metrics:
```bash
cd d:\Capstone_Project\RetailMind\ai_service
.\venv\Scripts\python.exe training\train_models.py
```

The script automatically:
1. Re-evaluates both models with 5-Fold CV and 80/20 test split.
2. Serializes updated weights to `app/ml_assets/voice/intent_model.pkl` and `app/ml_assets/voice/payment_model.pkl`.
3. Exports an academic evaluation report JSON to `ai_service/training/evaluation_report.json`.

---

## 6. Viva / Defense Preparation Q&A

**Q1. Professor: "Why did you choose Logistic Regression with TF-IDF over a deep transformer for this step?"**
> **Answer**: For intent and payment mode classification in small enterprise hardware (e.g., store point-of-sale laptops), TF-IDF with sublinear scaling and $L_2$-regularized Logistic Regression achieves sub-5 millisecond inference latency with zero GPU requirements, high interpretability, and robust performance on domain-specific vocabulary. For more complex semantic tasks (such as our RAG Store Copilot), we utilize our local multilingual sentence transformer.

**Q2. Professor: "How did you prevent data leakage during training?"**
> **Answer**: We strictly split the dataset using an 80/20 stratified split before vectorization fitting. The `TfidfVectorizer` is fitted solely on the training partition, ensuring the vocabulary and inverse document frequencies never see the test fold. Cross-validation is likewise executed strictly within the training set.

**Q3. Professor: "Where are the trained weights stored and how are they served?"**
> **Answer**: The trained weights are serialized into `ai_service/app/ml_assets/voice/intent_model.pkl` and `payment_model.pkl`. During startup, FastAPI's `voice_service.py` loads these pickled pipelines into memory and invokes `.predict()` on transcribed speech.
