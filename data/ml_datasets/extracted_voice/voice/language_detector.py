SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi"
}


def detect_language(whisper_language):

    if whisper_language in SUPPORTED_LANGUAGES:

        return {
            "language": whisper_language,
            "language_name": SUPPORTED_LANGUAGES[whisper_language],
            "confidence": None
        }

    return {
        "language": "unknown",
        "language_name": "Unknown",
        "confidence": None
    }