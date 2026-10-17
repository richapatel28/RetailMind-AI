import whisper

print("Loading Whisper model...")
model = whisper.load_model("small")
print("Whisper model loaded.")


SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
}


def transcribe_audio(audio_file, language=None):

    options = {
        "task": "transcribe",
        "fp16": False
    }

    # Use selected language if provided
    if language:
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: {language}. "
                f"Supported languages: {list(SUPPORTED_LANGUAGES.keys())}"
            )

        options["language"] = language

    result = model.transcribe(audio_file, **options)

    return {
        "text": result["text"].strip(),
        "whisper_language": result.get("language", "unknown")
    }