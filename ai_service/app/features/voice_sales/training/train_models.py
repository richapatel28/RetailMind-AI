"""
RetailMind AI - Machine Learning Model Training & Academic Evaluation Pipeline
Trains and evaluates NLP classifiers for multilingual voice sales:
1. Intent Classification Model (Predicts: sale, purchase, return)
2. Payment Mode Classification Model (Predicts: cash, upi, credit, unknown)

Includes:
- 80/20 Stratified Train/Test Split
- 5-Fold Cross Validation
- Accuracy, Precision, Recall, F1-Score (Macro & Weighted)
- Confusion Matrix for both models
- Serialization of fitted pipelines to app/ml_assets/voice/
- Generation of evaluation_report.json for academic viva defense
"""

import sys
import os
import csv
import json
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import joblib
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# Paths
BASE_DIR = Path(__file__).resolve().parent
FEATURE_DIR = BASE_DIR.parent
DATA_PATH = FEATURE_DIR / "dataset" / "voice_training.csv"
OUTPUT_ASSETS_DIR = FEATURE_DIR / "ml_assets"
REPORT_PATH = BASE_DIR / "evaluation_report.json"

os.makedirs(OUTPUT_ASSETS_DIR, exist_ok=True)


def load_dataset(csv_file):
    texts, intents, payments = [], [], []
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            t = (row.get("text") or "").strip()
            i = (row.get("intent") or "").strip()
            p = (row.get("payment") or "").strip()
            if t and i and p:
                texts.append(t)
                intents.append(i)
                payments.append(p)
    return texts, intents, payments


def build_pipeline():
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),
                sublinear_tf=True,
                min_df=1
            )
        ),
        (
            "classifier",
            LogisticRegression(
                C=2.5,
                max_iter=1000,
                random_state=42
            )
        )
    ])


def evaluate_model(model_name, pipeline, X_train, X_test, y_train, y_test):
    print(f"\n========================================================")
    print(f"TRAINING & EVALUATING: {model_name.upper()}")
    print(f"========================================================")
    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # 5-Fold Stratified Cross Validation on Train Set
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="accuracy")
    print(f"5-Fold CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    # Fit on training set
    pipeline.fit(X_train, y_train)

    # Predictions on Unseen Test Set
    y_pred = pipeline.predict(X_test)

    # Metrics
    acc = accuracy_score(y_test, y_pred)
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)

    prec_weighted = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec_weighted = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    labels = sorted(list(set(y_test) | set(y_pred)))
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    report_dict = classification_report(y_test, y_pred, labels=labels, output_dict=True, zero_division=0)

    print(f"\nTest Set Evaluation Metrics:")
    print(f"  * Accuracy:           {acc * 100:.2f}%")
    print(f"  * Macro Precision:    {prec_macro * 100:.2f}%")
    print(f"  * Macro Recall:       {rec_macro * 100:.2f}%")
    print(f"  * Macro F1-Score:     {f1_macro * 100:.2f}%")
    print(f"  * Weighted F1-Score:  {f1_weighted * 100:.2f}%")

    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, labels=labels, zero_division=0))

    print(f"Confusion Matrix (Labels: {labels}):")
    for row in cm:
        print(f"  {row.tolist()}")

    metrics = {
        "model_name": model_name,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "test_accuracy": round(float(acc), 4),
        "test_precision_macro": round(float(prec_macro), 4),
        "test_recall_macro": round(float(rec_macro), 4),
        "test_f1_macro": round(float(f1_macro), 4),
        "test_f1_weighted": round(float(f1_weighted), 4),
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "classification_report": report_dict
    }

    return metrics


def main():
    print("=== RETAILMIND AI: GENUINE ML MODEL TRAINING PIPELINE ===")
    print(f"Loading dataset from: {DATA_PATH}")

    texts, intents, payments = load_dataset(DATA_PATH)
    total_samples = len(texts)
    print(f"Total verified samples loaded: {total_samples}")

    # 1. Intent Model Train/Test Split (80/20 Stratified)
    X_train_i, X_test_i, y_train_i, y_test_i = train_test_split(
        texts, intents, test_size=0.20, random_state=42, stratify=intents
    )
    intent_pipeline = build_pipeline()
    intent_metrics = evaluate_model(
        "Voice Intent Classifier", intent_pipeline, X_train_i, X_test_i, y_train_i, y_test_i
    )

    # 2. Payment Model Train/Test Split (80/20 Stratified)
    X_train_p, X_test_p, y_train_p, y_test_p = train_test_split(
        texts, payments, test_size=0.20, random_state=42, stratify=payments
    )
    payment_pipeline = build_pipeline()
    payment_metrics = evaluate_model(
        "Payment Mode Classifier", payment_pipeline, X_train_p, X_test_p, y_train_p, y_test_p
    )

    # Retrain on full dataset for maximum production robustness
    print("\nFitting final production models on 100% dataset samples...")
    prod_intent_model = build_pipeline().fit(texts, intents)
    prod_payment_model = build_pipeline().fit(texts, payments)

    # Serialize Models
    intent_pkl_path = OUTPUT_ASSETS_DIR / "intent_model.pkl"
    payment_pkl_path = OUTPUT_ASSETS_DIR / "payment_model.pkl"

    joblib.dump(prod_intent_model, intent_pkl_path)
    joblib.dump(prod_payment_model, payment_pkl_path)

    print(f"Saved: {intent_pkl_path} ({os.path.getsize(intent_pkl_path)} bytes)")
    print(f"Saved: {payment_pkl_path} ({os.path.getsize(payment_pkl_path)} bytes)")

    # Save comprehensive evaluation report JSON
    report = {
        "dataset": {
            "total_samples": total_samples,
            "languages": ["English", "Hindi", "Marathi", "Gujarati"],
            "split_ratio": "80% Train, 20% Test (Stratified)"
        },
        "intent_model": intent_metrics,
        "payment_model": payment_metrics
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully exported academic evaluation report to: {REPORT_PATH}")
    print("\n=== ML MODEL TRAINING & EVALUATION PIPELINE COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()
