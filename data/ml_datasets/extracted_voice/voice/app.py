import sys

from speech_to_text import transcribe_audio
from language_detector import detect_language
from nlp import extract_transaction
from validation import validate_transaction


SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi"
}


def main():

    # -----------------------------
    # Get audio file
    # -----------------------------
    if len(sys.argv) < 2:
        print("Usage:")
        print("python app.py <audio_file> [language]")
        print()
        print("Examples:")
        print("python app.py english.m4a en")
        print("python app.py hindi.m4a hi")
        print("python app.py marathi.m4a mr")
        print("python app.py marathi.m4a")
        return

    audio_file = sys.argv[1]

    # -----------------------------
    # Get preferred language
    # -----------------------------
    preferred_language = None

    if len(sys.argv) >= 3:
        preferred_language = sys.argv[2].lower()

        if preferred_language not in SUPPORTED_LANGUAGES:
            print(
                f"Invalid language '{preferred_language}'. "
                f"Use: {', '.join(SUPPORTED_LANGUAGES.keys())}"
            )
            return

    # -----------------------------
    # Speech to Text
    # -----------------------------
    transcription = transcribe_audio(
        audio_file,
        preferred_language
    )

    text = transcription["text"]
    whisper_language = transcription["whisper_language"]

    # -----------------------------
    # Language
    # -----------------------------
    if preferred_language:
        language_code = preferred_language
    else:
        language_code = whisper_language

    language_name = SUPPORTED_LANGUAGES.get(
        language_code,
        "Unknown"
    )

    # -----------------------------
    # AI/NLP extraction
    # -----------------------------
    transaction = extract_transaction(
        text,
        language_code
    )

    # -----------------------------
    # Validation
    # -----------------------------
    validation = validate_transaction(transaction)

    # -----------------------------
    # Output
    # -----------------------------
    print("\n========== TRANSCRIPTION ==========")
    print(text)

    print("\n========== LANGUAGE ==========")
    print({
        "language": language_code,
        "language_name": language_name,
        "source": (
            "user_selected"
            if preferred_language
            else "whisper_auto_detected"
        )
    })

    print("\n========== AI EXTRACTION ==========")
    print(transaction)

    print("\n========== VALIDATION ==========")
    print(validation)


if __name__ == "__main__":
    main()