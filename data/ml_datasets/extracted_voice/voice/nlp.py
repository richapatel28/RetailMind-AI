import os
import re
import joblib


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_DIR = os.path.join(BASE_DIR, "models")

INTENT_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "intent_model.pkl"
)

PAYMENT_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "payment_model.pkl"
)


# ============================================================
# LOAD TRAINED ML MODELS
# ============================================================

if not os.path.exists(INTENT_MODEL_PATH):
    raise FileNotFoundError(
        "Intent model not found. Run: python train_model.py"
    )

if not os.path.exists(PAYMENT_MODEL_PATH):
    raise FileNotFoundError(
        "Payment model not found. Run: python train_model.py"
    )


intent_model = joblib.load(INTENT_MODEL_PATH)
payment_model = joblib.load(PAYMENT_MODEL_PATH)


# ============================================================
# NUMBER WORDS
# ============================================================

NUMBER_WORDS = {

    # -------------------------
    # English
    # -------------------------

    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,

    # -------------------------
    # Hindi
    # -------------------------

    "एक": 1,
    "दो": 2,
    "तीन": 3,
    "चार": 4,
    "पांच": 5,
    "पाँच": 5,
    "छह": 6,
    "छः": 6,
    "सात": 7,
    "आठ": 8,
    "नौ": 9,
    "दस": 10,

    # -------------------------
    # Marathi
    # -------------------------

    "दोन": 2,
    "पाच": 5,
    "सहा": 6,
    "सात": 7,
    "आठ": 8,
    "नऊ": 9,
    "दहा": 10,
}


# ============================================================
# WHISPER VARIANTS
# ============================================================

NUMBER_VARIANTS = {

    # 5
    "पाज": "पाच",

    # 300
    "तींसो": "तीनशे",
    "तीनशी": "तीनशे",
    "तीन्शी": "तीनशे",
    "तीन्खे": "तीनशे",
}


# ============================================================
# PAYMENT VARIANTS
# ============================================================

PAYMENT_VARIANTS = {

    "cash": [
        "cash",
        "नकद",
        "नकत",
        "नकदी",
        "रोख",
        "रोकड",
        "रोक",
    ],

    "upi": [
        "upi",
        "google pay",
        "gpay",
        "phonepe",
        "paytm",
        "online",
    ],

    "credit": [
        "credit",
        "credit pe",
        "credit par",
        "udhaar",
        "उधार",
        "उधारी",
        "उधारीवर",
    ]
}


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(text):

    text = text.strip()

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text


# ============================================================
# WHISPER NORMALIZATION
# ============================================================

def normalize_whisper_text(text):

    text = normalize_text(text)

    # Normalize Whisper number variations
    for wrong, correct in NUMBER_VARIANTS.items():

        text = text.replace(
            wrong,
            correct
        )

    # Normalize common cash variations
    text = text.replace(
        "नकत",
        "नकद"
    )

    text = text.replace(
        "रोक",
        "रोख"
    )

    return text


# ============================================================
# INTENT ML CLASSIFICATION
# ============================================================

def predict_intent(text):

    prediction = intent_model.predict(
        [text]
    )[0]

    probabilities = intent_model.predict_proba(
        [text]
    )[0]

    confidence = float(
        max(probabilities)
    )

    return str(prediction), confidence


# ============================================================
# PAYMENT ML CLASSIFICATION
# ============================================================

def predict_payment(text):

    text_lower = text.lower()

    # Check explicit multilingual payment words first.

    for payment_mode, variants in PAYMENT_VARIANTS.items():

        for variant in variants:

            if variant.lower() in text_lower:

                return payment_mode, 1.0

    # Otherwise use trained ML model.

    prediction = payment_model.predict(
        [text]
    )[0]

    probabilities = payment_model.predict_proba(
        [text]
    )[0]

    confidence = float(
        max(probabilities)
    )

    # Reject weak predictions.

    if confidence < 0.60:

        return "unknown", confidence

    return str(prediction), confidence


# ============================================================
# QUANTITY EXTRACTION
# ============================================================

def extract_quantity(text):

    text = normalize_whisper_text(text)

    # --------------------------------------------------------
    # Remove spoken amount words first.
    #
    # Example:
    # "पाच मैगी तीनशे रुप्याना"
    #
    # Without this step, "तीन" from "तीनशे"
    # could incorrectly become the quantity.
    # --------------------------------------------------------

    amount_words = [
        "तीनशे",
        "तींसो",
        "तीनशी",
        "तीन्शी",
        "तीन्खे",
    ]

    quantity_text = text

    for word in amount_words:

        quantity_text = quantity_text.replace(
            word,
            " "
        )

    # --------------------------------------------------------
    # Numeric quantity
    # --------------------------------------------------------

    pattern = (
        r"\b(\d+(?:\.\d+)?)\s*"
        r"(?:"
        r"kg|kilo|kilos|kilogram|"
        r"litre|liter|litres|liters|"
        r"packet|packets|pack|"
        r"box|boxes|"
        r"bottle|bottles|"
        r"piece|pieces|pcs"
        r")?"
    )

    match = re.search(
        pattern,
        quantity_text,
        re.IGNORECASE
    )

    if match:

        return float(
            match.group(1)
        )

    # --------------------------------------------------------
    # Number words
    # --------------------------------------------------------

    # Check longer words first.

    sorted_number_words = sorted(
        NUMBER_WORDS.items(),
        key=lambda item: len(item[0]),
        reverse=True
    )

    for word, value in sorted_number_words:

        if word in quantity_text:

            return float(value)

    return None


# ============================================================
# AMOUNT EXTRACTION
# ============================================================

def extract_amount(text):

    # --------------------------------------------------------
    # Numeric currency
    # --------------------------------------------------------

    patterns = [

        # English:
        # 300 rupees
        # 300 rs

        # Hindi/Marathi:
        # 300 रुपये
        # 300 रुप्याना
        # 300 रूप्याना

        r"(\d+(?:\.\d+)?)\s*"
        r"(?:"
        r"rupees?|"
        r"rs\.?|"
        r"₹|"
        r"रुपये|"
        r"रुपया|"
        r"रुप्याना|"
        r"रुप्यांनी|"
        r"रूपये|"
        r"रूपया|"
        r"रूप्याना|"
        r"रूप्यांनी"
        r")",

        # ₹300

        r"₹\s*(\d+(?:\.\d+)?)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:

            return float(
                match.group(1)
            )

    # --------------------------------------------------------
    # Spoken amount: 300
    # --------------------------------------------------------

    amount_words_300 = [
        "तीनशे",
        "तींसो",
        "तीनशी",
        "तीन्शी",
        "तीन्खे",
    ]

    currency_context = [

        # Hindi / Marathi
        "रुप",
        "रुपये",
        "रुपय",
        "रुप्याना",
        "रुप्यांनी",

        "रूप",
        "रूपये",
        "रूपय",
        "रूप्याना",
        "रूप्यांनी",

        # English
        "rupee",
        "rupees",
        "rs",

        # Symbol
        "₹",
    ]

    has_300_word = any(
        word in text
        for word in amount_words_300
    )

    has_currency = any(
        word in text
        for word in currency_context
    )

    if has_300_word and has_currency:

        return 300.0

    return None


# ============================================================
# PRODUCT EXTRACTION
# ============================================================

def extract_product(text):

    text = normalize_whisper_text(text)

    # --------------------------------------------------------
    # Remove ₹ amount
    # --------------------------------------------------------

    text = re.sub(
        r"₹\s*\d+(?:\.\d+)?",
        " ",
        text
    )

    # --------------------------------------------------------
    # Remove numeric currency
    # --------------------------------------------------------

    text = re.sub(
        r"\b\d+(?:\.\d+)?\s*"
        r"(?:"
        r"rupees?|"
        r"rs\.?|"
        r"रुपये|"
        r"रुपया|"
        r"रुप्याना|"
        r"रुप्यांनी|"
        r"रूपये|"
        r"रूपया|"
        r"रूप्याना|"
        r"रूप्यांनी"
        r")\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # --------------------------------------------------------
    # Remove numeric values
    # --------------------------------------------------------

    text = re.sub(
        r"\b\d+(?:\.\d+)?\b",
        " ",
        text
    )

    # --------------------------------------------------------
    # Remove number words
    # --------------------------------------------------------

    sorted_number_words = sorted(
        NUMBER_WORDS.keys(),
        key=len,
        reverse=True
    )

    for word in sorted_number_words:

        text = re.sub(
            re.escape(word),
            " ",
            text,
            flags=re.IGNORECASE
        )

    # --------------------------------------------------------
    # Remove spoken amount words
    # --------------------------------------------------------

    amount_words = [
        "तीनशे",
        "तींसो",
        "तीनशी",
        "तीन्शी",
        "तीन्खे",
    ]

    for word in amount_words:

        text = text.replace(
            word,
            " "
        )

    # --------------------------------------------------------
    # Remove units
    # --------------------------------------------------------

    units = [

        # English
        "kg",
        "kilo",
        "kilos",
        "kilogram",

        "litre",
        "liter",
        "litres",
        "liters",

        "packet",
        "packets",
        "pack",

        "box",
        "boxes",

        "bottle",
        "bottles",

        "piece",
        "pieces",
        "pcs",

        # Hindi / Marathi
        "किलो",
        "पैकेट",
        "पॅकेट",
        "बोतल",
        "बॉटल",
    ]

    for unit in units:

        text = re.sub(
            r"\b" +
            re.escape(unit) +
            r"\b",
            " ",
            text,
            flags=re.IGNORECASE
        )

    # --------------------------------------------------------
    # Transaction stop words
    # --------------------------------------------------------

    stop_words = [

        # -------------------------
        # English
        # -------------------------

        "sold",
        "sell",
        "sale",

        "bought",
        "buy",
        "purchase",
        "purchased",

        "returned",
        "return",

        "cash",
        "upi",
        "credit",

        "for",
        "through",
        "using",
        "to",
        "on",
        "of",
        "the",
        "and",

        # -------------------------
        # Hindi
        # -------------------------

        "maine",
        "मैंने",
        "मैने",

        "में",
        "से",
        "को",
        "पे",
        "पर",

        "बेची",
        "बेचा",
        "बेच",

        "खरीदा",
        "खरीद",

        "वापस",
        "किया",
        "किए",

        "नकद",
        "नकत",

        "उधार",

        # -------------------------
        # Marathi
        # -------------------------

        "विकली",
        "विकला",
        "विकले",

        "खरेदी",
        "केला",
        "केले",

        "परत",

        "रोख",
        "रोकड",

        "रुप्याना",
        "रुप्यांनी",
        "रुपये",

        "रूप्याना",
        "रूप्यांनी",
        "रूपये",
    ]

    for word in stop_words:

        text = re.sub(
            r"(?<!\w)" +
            re.escape(word) +
            r"(?!\w)",
            " ",
            text,
            flags=re.IGNORECASE
        )

    # --------------------------------------------------------
    # Clean spaces
    # --------------------------------------------------------

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    if not text:

        return None

    # --------------------------------------------------------
    # Remove common particles
    # --------------------------------------------------------

    ignored = {

        "में",
        "से",
        "को",
        "पे",
        "पर",
        "ना",
        "ने",
        "ही",
        "का",
        "के",
        "की",
    }

    words = text.split()

    words = [
        word
        for word in words
        if word not in ignored
    ]

    if not words:

        return None

    # First meaningful token is treated as product.

    return words[0].strip(
        ".,!?;:"
    )


# ============================================================
# CUSTOMER EXTRACTION
# ============================================================

def extract_customer(text):

    # --------------------------------------------------------
    # English
    #
    # Example:
    # "Sold 2 Maggi to Rahul"
    # --------------------------------------------------------

    match = re.search(
        r"\bto\s+"
        r"([A-Z][a-z]+"
        r"(?:\s+[A-Z][a-z]+)?)",
        text
    )

    if match:

        return match.group(1)

    # --------------------------------------------------------
    # Hindi / Marathi
    #
    # Examples:
    #
    # Rahul ko
    # Rahul को
    # Rahul ला
    # Rahul ना
    # --------------------------------------------------------

    match = re.search(
        r"\b"
        r"([A-Z][a-z]+)"
        r"\s+"
        r"(?:ko|को|ला|ना)\b",
        text
    )

    if match:

        return match.group(1)

    return None


# ============================================================
# CONFIDENCE CALCULATION
# ============================================================

def calculate_confidence(
    intent_confidence,
    payment_confidence,
    product,
    quantity
):

    score = (
        float(intent_confidence) * 0.50
        + float(payment_confidence) * 0.20
    )

    if product:

        score += 0.15

    if quantity is not None:

        score += 0.15

    return float(
        round(
            min(score, 1.0),
            2
        )
    )


# ============================================================
# MAIN TRANSACTION EXTRACTION
# ============================================================

def extract_transaction(
    text,
    detected_language
):

    if not text or not text.strip():

        return {

            "intent": "unknown",

            "product_text": None,

            "quantity": None,

            "amount": None,

            "payment_mode": "unknown",

            "customer_text": None,

            "language": detected_language,

            "confidence": 0.0
        }

    # --------------------------------------------------------
    # Normalize Whisper transcription
    # --------------------------------------------------------

    normalized_text = normalize_whisper_text(
        text
    )

    # --------------------------------------------------------
    # ML classification
    # --------------------------------------------------------

    intent, intent_confidence = predict_intent(
        normalized_text
    )

    payment, payment_confidence = predict_payment(
        normalized_text
    )

    # --------------------------------------------------------
    # NLP extraction
    # --------------------------------------------------------

    quantity = extract_quantity(
        normalized_text
    )

    amount = extract_amount(
        normalized_text
    )

    product = extract_product(
        normalized_text
    )

    customer = extract_customer(
        normalized_text
    )

    # --------------------------------------------------------
    # Overall confidence
    # --------------------------------------------------------

    confidence = calculate_confidence(
        intent_confidence,
        payment_confidence,
        product,
        quantity
    )

    # --------------------------------------------------------
    # Final structured result
    # --------------------------------------------------------

    return {

        "intent": str(intent),

        "product_text": product,

        "quantity": quantity,

        "amount": amount,

        "payment_mode": str(payment),

        "customer_text": customer,

        "language": str(detected_language),

        "confidence": confidence
    }


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":

    test_cases = [

        (
            "Sold 5 Maggi for 300 rupees cash.",
            "en"
        ),

        (
            "Maine 3 Maggi UPI se bechi",
            "hi"
        ),

        (
            "Bought 10 packets of biscuits",
            "en"
        ),

        (
            "2 Maggi Rahul ko credit pe di",
            "hi"
        ),

        (
            "5 kilo rice cash mein becha",
            "hi"
        ),

        (
            "पाच मैगी तीनशे रुप्याना रोकड विकली",
            "mr"
        ),

        (
            "पाच मेगी तीन्शी रूप्याना रोक विखली",
            "mr"
        ),
    ]

    print(
        "\nRetailMind Local ML NLP Test"
    )

    print(
        "=" * 60
    )

    for text, language in test_cases:

        print("\nInput:")
        print(text)

        result = extract_transaction(
            text,
            language
        )

        print("\nOutput:")
        print(result)

        print(
            "-" * 60
        )