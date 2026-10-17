import re


def normalize_text(text: str) -> str:
    if not text:
        return ""

    # Convert to lowercase
    text = text.lower()

    # Remove punctuation while preserving alphanumeric and Devanagari / Indic characters
    text = re.sub(r"[^\w\s\u0900-\u097f\u0a80-\u0aff]", " ", text)
    text = re.sub(r"[_]", " ", text)

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text)

    # Trim
    return text.strip()
