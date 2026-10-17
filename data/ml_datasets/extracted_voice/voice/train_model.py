import os
import joblib
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "voice_training.csv"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(DATA_FILE)

df = df.dropna(
    subset=["text", "intent", "payment"]
)

print("Training samples:", len(df))


# ============================================================
# INTENT MODEL
# ============================================================

intent_model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            sublinear_tf=True
        )
    ),
    (
        "classifier",
        LogisticRegression(
            max_iter=1000
        )
    )
])


intent_model.fit(
    df["text"],
    df["intent"]
)


# ============================================================
# PAYMENT MODEL
# ============================================================

payment_model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            sublinear_tf=True
        )
    ),
    (
        "classifier",
        LogisticRegression(
            max_iter=1000
        )
    )
])


payment_model.fit(
    df["text"],
    df["payment"]
)


# ============================================================
# SAVE MODELS
# ============================================================

intent_path = os.path.join(
    MODEL_DIR,
    "intent_model.pkl"
)

payment_path = os.path.join(
    MODEL_DIR,
    "payment_model.pkl"
)

joblib.dump(
    intent_model,
    intent_path
)

joblib.dump(
    payment_model,
    payment_path
)


print("\nModels trained successfully.")

print(
    "Intent model:",
    intent_path
)

print(
    "Payment model:",
    payment_path
)