import os
import re
import shutil
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

import joblib
import whisper

from app.features.product_matching.service import match_product

logger = logging.getLogger(__name__)

# ============================================================
# 1. ENSURE FFMPEG FOR WHISPER AUDIO DECODING
# ============================================================

def ensure_ffmpeg_in_path():
    """Ensure ffmpeg executable is available in PATH for Whisper."""
    import sys
    scripts_dir = os.path.join(sys.prefix, "Scripts")
    if scripts_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = scripts_dir + os.pathsep + os.environ.get("PATH", "")

    if shutil.which("ffmpeg"):
        return

    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        target = os.path.join(scripts_dir, "ffmpeg.exe")
        if not os.path.exists(target):
            shutil.copyfile(ffmpeg_exe, target)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    except Exception as exc:
        logger.warning(f"Could not automatically configure ffmpeg from imageio_ffmpeg: {exc}")

ensure_ffmpeg_in_path()


# ============================================================
# 2. PATHS & ML MODEL ASSETS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml_assets"
INTENT_MODEL_PATH = MODEL_DIR / "intent_model.pkl"
PAYMENT_MODEL_PATH = MODEL_DIR / "payment_model.pkl"

_intent_model = None
_payment_model = None
_whisper_model = None

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
    "gu": "Gujarati"
}


def get_intent_model():
    global _intent_model
    if _intent_model is None:
        if not INTENT_MODEL_PATH.exists():
            raise FileNotFoundError(f"Intent model not found at {INTENT_MODEL_PATH}")
        _intent_model = joblib.load(str(INTENT_MODEL_PATH))
    return _intent_model


def get_payment_model():
    global _payment_model
    if _payment_model is None:
        if not PAYMENT_MODEL_PATH.exists():
            raise FileNotFoundError(f"Payment model not found at {PAYMENT_MODEL_PATH}")
        _payment_model = joblib.load(str(PAYMENT_MODEL_PATH))
    return _payment_model


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        ensure_ffmpeg_in_path()
        logger.info("Loading Whisper 'small' model...")
        _whisper_model = whisper.load_model("small")
        logger.info("Whisper 'small' model loaded successfully.")
    return _whisper_model


# ============================================================
# 3. DICTIONARIES & VARIANTS
# ============================================================

INDIC_DIGITS = {
    '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4', '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

NUMBER_WORDS = {
    # English
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
    # Hindi
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
    "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15,
    "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
    "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90, "सौ": 100,
    # Marathi
    "दोन": 2, "पाच": 5, "सहा": 6, "सात": 7, "आठ": 8, "नऊ": 9, "दहा": 10,
    "अकरा": 11, "बारा": 12, "तेरा": 13, "चौदा": 14, "पंधरा": 15,
    "सोळा": 16, "सतरा": 17, "अठरा": 18, "एकोणीस": 19, "वीस": 20,
    "तीस": 30, "चाळीस": 40, "પन्नास": 50, "साठ": 60, "सत्तर": 70, "ऐंशी": 80, "नव्वद": 90, "शंभर": 100,
    # Gujarati
    "એક": 1, "બે": 2, "ત્રણ": 3, "ચાર": 4, "પાંચ": 5, "છ": 6, "સાત": 7, "આઠ": 8, "નવ": 9, "દસ": 10,
    "અગિયાર": 11, "બાર": 12, "તેર": 13, "ચૌદ": 14, "પંદર": 15, "સોળ": 16, "સત્તર": 17, "અઢાર": 18, "ઓગણીસ": 19, "વીસ": 20,
    "ત્રીસ": 30, "ચાલીસ": 40, "પચાસ": 50, "સાઠ": 60, "સીંતેર": 70, "એંસી": 80, "નેવું": 90, "સો": 100,
}

NUMBER_VARIANTS = {
    # 5
    "पाज": "पाच",
    # 300
    "तींसो": "तीनशे",
    "तीनशी": "तीनशे",
    "तीन्शी": "तीनशे",
    "तीन्खे": "तीनशे",
}

PAYMENT_VARIANTS = {
    "cash": [
        "cash", "नकद", "नकत", "नकदी", "रोख", "रोकड", "रोक",
        "રોકડ", "રોકડા", "રોકડેથી", "રોકડામાં",
    ],
    "upi": [
        "upi", "google pay", "gpay", "phonepe", "paytm", "online",
        "યુપીઆઈ", "ઓનલાઇન", "ઓનલાઈન", "જીપે", "પેટીએમ",
    ],
    "credit": [
        "credit", "credit pe", "credit par", "udhaar", "उधार", "उधारी", "उधारीवर",
        "ઉધાર", "ઉધારી", "ખાતામાં",
    ]
}


# ============================================================
# 4. NORMALIZATION & PREDICTION UTILITIES
# ============================================================

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    return re.sub(r"\s+", " ", text)


def normalize_whisper_text(text: str) -> str:
    text = normalize_text(text)
    # Convert Gujarati and Devanagari numerals to ASCII digits
    text = "".join(INDIC_DIGITS.get(c, c) for c in text)
    for wrong, correct in NUMBER_VARIANTS.items():
        text = text.replace(wrong, correct)
    text = text.replace("नकत", "नकद")
    text = text.replace("रोक", "रोख")
    return text


def predict_intent(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    sale_keywords = [
        "sold", "sell", "sale", "बेचा", "बेचे", "बेची", "विकला", "विकले", "विकली",
        "વેચી", "વેચ્યા", "વેચ્યું", "વેચ્યાં", "આપ્યા", "આપ્યો", "આપી", "વેચાણ"
    ]
    purchase_keywords = [
        "bought", "buy", "purchase", "purchased", "खरीदा", "खरीदे", "खरीदी",
        "खरेदी", "खरेदी केली", "ખરીદ્યા", "ખરીદ્યું", "ખરીદી", "લીધા", "લીધું"
    ]
    for kw in sale_keywords:
        if re.search(r"(?<!\w)" + re.escape(kw) + r"(?!\w)", text_lower):
            return "sale", 0.95
    for kw in purchase_keywords:
        if re.search(r"(?<!\w)" + re.escape(kw) + r"(?!\w)", text_lower):
            return "purchase", 0.95

    model = get_intent_model()
    prediction = model.predict([text])[0]
    probabilities = model.predict_proba([text])[0]
    confidence = float(max(probabilities))
    return str(prediction), confidence


def predict_payment(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    for payment_mode, variants in PAYMENT_VARIANTS.items():
        for variant in variants:
            if variant.lower() in text_lower:
                return payment_mode, 1.0

    model = get_payment_model()
    prediction = model.predict([text])[0]
    probabilities = model.predict_proba([text])[0]
    confidence = float(max(probabilities))

    if confidence < 0.60:
        return "unknown", confidence

    return str(prediction), confidence


def extract_quantity(text: str) -> Optional[float]:
    text = normalize_whisper_text(text)
    amount_words = ["तीनशे", "तींसो", "तीनशी", "तीन्शी", "तीन्खे"]
    quantity_text = text
    for word in amount_words:
        quantity_text = quantity_text.replace(word, " ")

    # Strip currency expressions so amounts are never confused with quantity
    quantity_text = re.sub(r"₹\s*\d+(?:\.\d+)?", " ", quantity_text)
    quantity_text = re.sub(
        r"\d+(?:\.\d+)?\s*(?:rupees?|rs\.?|रुपये|रुपया|रुप्याना|रुप्यांनी|रूपये|रूपया|रु|રૂપિયા|રૂપિયામાં|રૂપિયાના|રૂપિયાથી|રૂ\.?)",
        " ",
        quantity_text,
        flags=re.IGNORECASE
    )
    quantity_text = re.sub(
        r"(?:rupees?|rs\.?|रुपये|रुपया|रूपये|रु|રૂપિયા|રૂ\.?)\s*\d+(?:\.\d+)?",
        " ",
        quantity_text,
        flags=re.IGNORECASE
    )

    unit_pattern = (
        r"(?:"
        r"kg|kilo|kilos|kilogram|"
        r"litre|liter|litres|liters|"
        r"packet|packets|pack|"
        r"box|boxes|"
        r"bottle|bottles|"
        r"piece|pieces|pcs|"
        r"किलो|पैकेट|पॅकेट|बोतल|बॉटल|पीस|"
        r"કિલો|પેકેટ|પાકીટ|બોટલ|ડબ્બી|નંગ|લીટર|ગ્રામ"
        r")"
    )

    sorted_number_words = sorted(
        NUMBER_WORDS.items(),
        key=lambda item: len(item[0]),
        reverse=True
    )

    # 1. Number word + unit (e.g. "दो पैकेट", "two packets", "૨ પેકેટ")
    for word, value in sorted_number_words:
        if re.search(r"(?<!\w)" + re.escape(word) + r"\s*" + unit_pattern, quantity_text, re.IGNORECASE):
            return float(value)

    # 2. Digit + unit (e.g. "2 packets", "5 kg", "૨ પેકેટ")
    match = re.search(r"\b(\d+(?:\.\d+)?)\s*" + unit_pattern, quantity_text, re.IGNORECASE)
    if match:
        return float(match.group(1))

    # 3. Recognize speech homophone "to" or "too" when used as quantity after sold/sell (e.g. "Sold to Maggi")
    homophone = re.search(r"\b(?:sold|sell|sale)\s+(?:to|too)\b", text, re.IGNORECASE)
    if homophone:
        return 2.0

    # 4. Standalone digit (e.g. "Sold 2 Maggi", "૨ મેગી")
    match = re.search(r"\b(\d+(?:\.\d+)?)\b", quantity_text)
    if match:
        return float(match.group(1))

    # 5. Standalone number word (e.g. "दो", "two", "five", "બે")
    for word, value in sorted_number_words:
        if re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", quantity_text, re.IGNORECASE):
            return float(value)

    return None


def extract_amount(text: str) -> Optional[float]:
    normalized = normalize_whisper_text(text)
    patterns = [
        # Number followed by currency: "45 rupees", "45 rs", "45 ₹", "45 रुपये", "30 રૂપિયા"
        r"(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹|रुपये|रुपया|रुप्याना|रुप्यांनी|रूपये|रूपया|રૂપિયા|રૂપિયામાં|રૂપિયાના|રૂપિયાથી|રૂ\.?)",
        # Currency followed by number: "Rs 45", "Rs. 45", "Rupees 45", "₹45", "₹ 45", "रुपये 45", "રૂપિયા 45"
        r"(?:rupees?|rs\.?|₹|रुपये|रुपया|रूपये|રૂપિયા|રૂ\.?)\s*(\d+(?:\.\d+)?)",
        # "for 45 in cash", "for 45 cash", "for Rs 45", "30 રૂપિયામાં રોકડ"
        r"\b(?:for|at|pe|par|માટે|માં|ના|એ|पर)\s+(?:rs\.?|rupees?|₹|રૂપિયા|રૂ)?\s*(\d+(?:\.\d+)?)\s*(?:in\s+cash|by\s+cash|cash|in\s+upi|upi|credit|rupees?|rs\.?|रुपये|રૂપિયા|રોકડ|રોકડા|नकद|रोख|online)?\b",
        # Standalone "₹ 45"
        r"₹\s*(\d+(?:\.\d+)?)",
    ]

    for pattern in patterns:
        match = re.search(pattern, normalized, re.IGNORECASE)
        if match:
            return float(match.group(1))

    amount_words_300 = ["तीनशे", "तींसो", "तीनशी", "तीन्शी", "तीन्खे"]
    currency_context = [
        "रुप", "रुपये", "रुपय", "रुप्याना", "रुप्यांनी",
        "रूप", "रूपये", "रूपय", "रूप्याना", "रूप्यांनी",
        "rupee", "rupees", "rs", "₹", "રૂપિયા", "રૂ"
    ]

    has_300_word = any(word in normalized for word in amount_words_300)
    has_currency = any(word in normalized for word in currency_context)

    if has_300_word and has_currency:
        return 300.0

    return None


def extract_product(text: str) -> Optional[str]:
    text = normalize_whisper_text(text)
    # Strip currency expressions
    text = re.sub(r"₹\s*\d+(?:\.\d+)?", " ", text)
    text = re.sub(
        r"\d+(?:\.\d+)?\s*(?:rupees?|rs\.?|रुपये|रुपया|रुप्याना|रुप्यांनी|रूपये|रूपया|रु|રૂપિયા|રૂપિયામાં|રૂપિયાના|રૂપિયાથી|રૂ\.?)",
        " ",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r"(?:rupees?|rs\.?|रुपये|रुपया|रूपये|रु|રૂપિયા|રૂ\.?)\s*\d+(?:\.\d+)?",
        " ",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(r"\b\d+(?:\.\d+)?\b", " ", text)

    # Strip units (English, Hindi, Marathi, Gujarati)
    units = [
        "kg", "kilo", "kilos", "kilogram", "litre", "liter", "litres", "liters",
        "packet", "packets", "pack", "box", "boxes", "bottle", "bottles",
        "piece", "pieces", "pcs", "unit", "units", "किलो", "पैकेट", "पॅकेट", "बोतल", "बॉटल", "पीस",
        "કિલો", "પેકેટ", "પાકીટ", "બોટલ", "ડબ્બી", "નંગ", "લીટર", "ગ્રામ"
    ]
    for unit in units:
        text = re.sub(r"(?<!\w)" + re.escape(unit) + r"(?!\w)", " ", text, flags=re.IGNORECASE)

    # Strip number words
    sorted_number_words = sorted(NUMBER_WORDS.keys(), key=len, reverse=True)
    for word in sorted_number_words:
        text = re.sub(r"(?<!\w)" + re.escape(word) + r"(?!\w)", " ", text, flags=re.IGNORECASE)

    amount_words = ["तीनशे", "तींसो", "तीनशी", "तीन्शी", "तीन्खे"]
    for word in amount_words:
        text = text.replace(word, " ")

    stop_words = [
        "sold", "sell", "sale", "bought", "buy", "purchase", "purchased",
        "returned", "return", "cash", "upi", "credit", "for", "through",
        "using", "to", "on", "of", "the", "and", "by", "via", "with", "at", "per",
        "in", "into", "from", "a", "an", "is", "are", "was", "were",
        "worth", "amount", "cost", "total",
        "rupees", "rupee", "rs", "inr",
        "maine", "मैंने", "मैने", "में", "से", "को", "पे", "पर",
        "बेचे", "बेची", "बेचा", "बेच", "खरीदे", "खरीदी", "खरीदा", "खरीद",
        "वापस", "किया", "किए", "नकद", "नकत", "उधार",
        "विकली", "विकला", "विकले", "खरेदी", "केला", "केले", "परत", "रोख", "रोकड",
        "रुप्याना", "रुप्यांनी", "रुपये", "रूप्याना", "रूप्यांनी", "रूपये",
        "વેચી", "વેચ્યા", "વેચ્યું", "વેચ્યાં", "આપ્યા", "આપ્યો", "આપી",
        "લીધા", "લીધું", "લીધી", "ખરીદ્યા", "ખરીદ્યું", "પાછા", "કર્યા", "કર્યું",
        "હતા", "હતી", "છે", "નું", "ના", "ની", "નો", "માં", "થી", "ને", "માટે",
        "રૂપિયા", "રૂપિયામાં", "રૂપિયાના", "રૂપિયાથી", "રૂ.", "રૂ", "રોકડ", "રોકડા", "ઉધાર", "યુપીઆઈ"
    ]

    # Sort stop words with longer forms before stems
    for word in sorted(stop_words, key=len, reverse=True):
        text = re.sub(r"(?<!\w)" + re.escape(word) + r"(?!\w)", " ", text, flags=re.IGNORECASE)

    # Clean punctuation including Hindi/Marathi purnaviram (।)
    text = re.sub(r"[।.,!?:;\"'()\[\]{}]", " ", text)
    # Clean orphan Indic vowel signs (not preceded by an Indic consonant)
    text = re.sub(r"(?<![\u0904-\u0939\u0a85-\u0ab9])[\u093e-\u094f\u0962\u0963\u0abe-\u0acf]+", " ", text)

    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None

    ignored = {
        "में", "से", "को", "पे", "पर", "ना", "ने", "ही", "का", "के", "की", "तो", "भी",
        "માં", "થી", "ને", "નો", "ની", "નું", "ના", "માટે",
        "in", "of", "for", "a", "an", "the", "to", "by", "is", "at", "per", "on", "with"
    }
    words = [w for w in text.split() if w not in ignored]

    if not words:
        return None

    # Preserve the full product phrase (e.g., "Surf Excel", "Tata Salt", "મેગી", "मैगी")
    product_phrase = " ".join(words).strip(".,!?;:")
    return product_phrase if product_phrase else None


def extract_customer(text: str) -> Optional[str]:
    clean_text = text.strip()

    # 1. Gujarati Unicode Patterns:
    # "રમેશભાઈને ઉધાર", "રમેશને ૨ મેગી", "ગ્રાહક મુકેશ"
    gu_prefix_match = re.search(r"(?:ગ્રાહક|નામ)\s+([\u0A80-\u0AFF]+(?:\s+[\u0A80-\u0AFF]+)?)", clean_text)
    if gu_prefix_match:
        return gu_prefix_match.group(1).strip()

    gu_suffix_match = re.search(r"([\u0A80-\u0AFF]+?)(?:ભાઈને|કાકાને|બેનને|શેઠને|ને)\b", clean_text)
    if gu_suffix_match:
        cand = gu_suffix_match.group(1).strip()
        # Filter out common Gujarati non-name words ending with 'ને'
        if cand not in ["આ", "તે", "દુકાન", "બધા", "કોઈ"]:
            # If the original matched brother/uncle suffix, keep the respectful title
            full_match = re.search(r"([\u0A80-\u0AFF]+(?:ભાઈ|કાકા|બેન|શેઠ))\b", clean_text)
            return full_match.group(1).strip() if full_match else cand

    # 2. English / Transliterated: "to Ramesh", "for Ramesh", "customer Ramesh"
    stopwords = {"cash", "credit", "udhar", "rupee", "rupees", "rs", "to", "sold", "sale", "sell", "give", "gave", "product"}

    to_match = re.search(r"\b(?:to|for|customer|cust)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", clean_text, re.IGNORECASE)
    if to_match:
        cand = to_match.group(1).strip()
        first_word = cand.split()[0].lower()
        if first_word not in stopwords:
            return cand.title()

    # 3. Indic Postposition: "Ramesh ne", "Ramesh ko", "Ramesh bhai ne", "Rahul ला"
    post_match = re.search(r"\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:ne|ko|ko\s+diya|la|na|bhai\s+ne|kaka\s+ne)\b", clean_text, re.IGNORECASE)
    if post_match:
        cand = post_match.group(1).strip()
        first_word = cand.split()[0].lower()
        if first_word not in stopwords:
            return cand.title()

    return None


def calculate_confidence(
    intent_confidence: float,
    payment_confidence: float,
    product: Optional[str],
    quantity: Optional[float]
) -> float:
    if not product or quantity is None:
        # Cannot be confident about a sale without identifying both product and quantity
        score = float(intent_confidence) * 0.20 + float(payment_confidence) * 0.15
        if product:
            score += 0.10
        if quantity is not None:
            score += 0.10
        return float(round(min(score, 0.40), 2))

    score = float(intent_confidence) * 0.35 + float(payment_confidence) * 0.15 + 0.30 + 0.20
    return float(round(min(score, 1.0), 2))


def validate_transaction(data: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    if "error" in data:
        return {"valid": False, "errors": [data["error"]]}

    if data.get("intent") == "unknown":
        errors.append("Transaction type could not be identified")

    if data.get("intent") in ["sale", "purchase"]:
        if not data.get("product_text"):
            errors.append("Product not identified")
        if not data.get("quantity"):
            errors.append("Quantity not identified")

    if data.get("amount") is not None:
        if data["amount"] <= 0:
            errors.append("Invalid amount")

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


# ============================================================
# 5. HIGH LEVEL PIPELINE
# ============================================================

def transcribe_audio_file(audio_path: str, language: Optional[str] = None) -> Dict[str, str]:
    model = get_whisper_model()
    options = {
        "task": "transcribe",
        "fp16": False
    }
    if language and language in SUPPORTED_LANGUAGES:
        options["language"] = language

    result = model.transcribe(audio_path, **options)
    return {
        "text": result["text"].strip(),
        "whisper_language": result.get("language", "unknown")
    }


CONJUNCTION_PATTERN = re.compile(
    r"\s*(?:and|also|plus|aur|और|तथा|एवं|ani|आणि|व|तसेच|ane|અને|તેમજ|,)\s+",
    re.IGNORECASE
)

TAIL_PATTERN = re.compile(
    r"(?:\s+(?:for|at|pe|par|માટે|માં|ના|રુપિયા|રૂપિયા)\s*)?"
    r"(?:\d+(?:\.\d+)?\s*(?:rupees?|rs\.?|₹|रुपये|रुपया|रूपये|રૂપિયા|રૂ|रोख|रोकड|રોકડ)?\s*)?"
    r"(?:in\s+cash|by\s+cash|cash|upi|credit|online|नकद|रोख|रोकड|રોકડ|રોકડા|યુપીઆઈ|उधार|ઉધાર)?$",
    re.IGNORECASE
)


def extract_items(normalized_text: str, preferred_language: Optional[str] = None) -> List[Dict[str, Any]]:
    # Remove leading action words
    cleaned = re.sub(
        r"^(?:sold|sell|sale|मैंने|મેં|આમે|आम्ही|बेचे|विकले|વેચ્યા|આપ્યા)\s+",
        "",
        normalized_text,
        flags=re.IGNORECASE
    )

    raw_parts = CONJUNCTION_PATTERN.split(cleaned)
    items = []

    for i, part in enumerate(raw_parts):
        # Strip tail currency/payment from the last item clause
        if i == len(raw_parts) - 1:
            part = TAIL_PATTERN.sub("", part).strip()
        if not part.strip():
            continue

        item_qty = extract_quantity(part) or 1.0
        item_product_text = extract_product(part)
        item_amount = extract_amount(part)

        if item_product_text:
            match_summary = None
            try:
                match_summary = match_product(item_product_text)
            except Exception as exc:
                logger.error(f"Product matching failed for '{item_product_text}': {exc}")
                match_summary = {
                    "input": item_product_text,
                    "matched_product": None,
                    "candidates": [],
                    "confidence": 0.0,
                    "status": "ERROR"
                }

            items.append({
                "product_text": item_product_text,
                "quantity": float(item_qty),
                "unit": None,
                "unit_price": None,
                "total_amount": float(item_amount) if item_amount is not None else None,
                "product_match": match_summary
            })

    return items


def parse_voice_text(raw_text: str, preferred_language: Optional[str] = None, whisper_lang: str = "en") -> Dict[str, Any]:
    """
    Parse voice text directly:
    1. Extract intent, products (multi or single), quantity, amount, payment, customer
    2. Validate extracted fields
    3. Call Product Matcher for each detected product
    4. Return structured response conforming to VoiceParseResponse
    """
    detected_lang = preferred_language if preferred_language else whisper_lang
    normalized_text = normalize_whisper_text(raw_text)

    # ML / Rule Classification
    intent, intent_conf = predict_intent(normalized_text)
    payment, payment_conf = predict_payment(normalized_text)
    customer = extract_customer(normalized_text)
    overall_amount = extract_amount(normalized_text)

    # Extract all items in basket (multi-product or single-product)
    items = extract_items(normalized_text, preferred_language)

    # Fallback to single item extraction if conjunction split didn't yield items
    if not items:
        qty = extract_quantity(normalized_text) or 1.0
        prod_text = extract_product(normalized_text)
        match_summary = None
        if prod_text:
            try:
                match_summary = match_product(prod_text)
            except Exception as exc:
                logger.error(f"Product matching failed for '{prod_text}': {exc}")
                match_summary = {
                    "input": prod_text,
                    "matched_product": None,
                    "candidates": [],
                    "confidence": 0.0,
                    "status": "ERROR"
                }
        if prod_text or match_summary:
            items.append({
                "product_text": prod_text,
                "quantity": float(qty),
                "unit": None,
                "unit_price": None,
                "total_amount": float(overall_amount) if overall_amount is not None else None,
                "product_match": match_summary
            })

    primary_item = items[0] if items else None
    primary_product_text = primary_item["product_text"] if primary_item else None
    primary_quantity = primary_item["quantity"] if primary_item else (extract_quantity(normalized_text) or 1.0)
    primary_product_match = primary_item["product_match"] if primary_item else None

    # Calculate overall confidence across items
    if items:
        item_confidences = [
            float(it.get("product_match", {}).get("confidence", 0.0))
            for it in items if it.get("product_match")
        ]
        avg_match_conf = sum(item_confidences) / len(item_confidences) if item_confidences else 0.0
        all_matched = all(it.get("product_match", {}).get("status") == "MATCHED" for it in items)

        if all_matched and len(items) > 0:
            confidence = round(0.25 * intent_conf + 0.15 * payment_conf + 0.50 * avg_match_conf + 0.10, 2)
            confidence = min(1.0, max(confidence, 0.90))
            status = "MATCHED"
        elif any(it.get("product_match", {}).get("matched_product") for it in items):
            confidence = min(0.65, round(0.30 * intent_conf + 0.20 * payment_conf + 0.40 * avg_match_conf, 2))
            status = "REVIEW_REQUIRED"
        else:
            confidence = 0.30
            status = "NO_MATCH"
    else:
        confidence = 0.20
        status = "NO_MATCH"

    extraction_data = {
        "intent": intent,
        "product_text": primary_product_text,
        "quantity": primary_quantity,
        "amount": overall_amount,
        "payment_mode": payment,
        "customer": customer,
        "language": detected_lang,
        "confidence": confidence
    }

    validation_result = validate_transaction(extraction_data)
    if not validation_result["valid"] and status == "MATCHED":
        status = "REVIEW_REQUIRED"

    return {
        "transcript": raw_text,
        "intent": intent,
        "product_text": primary_product_text,
        "quantity": primary_quantity,
        "amount": overall_amount,
        "customer": customer,
        "payment_mode": payment,
        "language": detected_lang,
        "confidence": confidence,
        "status": status,
        "product_match": primary_product_match,
        "items": items,
        "validation": validation_result
    }


def parse_voice_audio(audio_path: str, preferred_language: Optional[str] = None) -> Dict[str, Any]:
    """
    Full Voice pipeline:
    1. Transcribe audio with Whisper
    2. Delegate to parse_voice_text
    """
    transcription = transcribe_audio_file(audio_path, preferred_language)
    raw_text = transcription["text"]
    whisper_lang = transcription.get("whisper_language", "unknown")
    return parse_voice_text(raw_text, preferred_language, whisper_lang)
