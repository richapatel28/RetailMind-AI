import os
import shutil
import tempfile
import logging
from typing import Optional
from pathlib import Path

from pydantic import BaseModel
from fastapi import APIRouter, File, UploadFile, Form, HTTPException

from app.features.voice_sales.models import VoiceParseResponse
from app.features.voice_sales.service import parse_voice_audio, parse_voice_text

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai/voice",
    tags=["Voice Sales Analysis"]
)


class VoiceTextRequest(BaseModel):
    text: str
    language: Optional[str] = None


@router.post("/parse-text", response_model=VoiceParseResponse)
async def parse_voice_text_endpoint(payload: VoiceTextRequest):
    """
    Parse a text string (already transcribed) as a voice sales command.
    Detects intent, extracts product/quantity/payment info.
    Supports English, Hindi, Gujarati, Marathi.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        preferred_lang = payload.language.lower().strip() if payload.language else None
        result = parse_voice_text(
            raw_text=payload.text.strip(),
            preferred_language=preferred_lang
        )
        return result
    except Exception as exc:
        logger.error(f"Voice text parsing error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Voice text parsing failed: {str(exc)}"
        )


@router.post("/parse", response_model=VoiceParseResponse)
async def parse_voice(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Transcribe an audio file via Whisper then parse the voice sales command.
    Accepts .m4a, .mp3, .wav, .ogg, .webm.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Audio file must have a filename")

    suffix = Path(file.filename).suffix or ".m4a"

    temp_audio = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_audio = tmp.name
            shutil.copyfileobj(file.file, tmp)

        preferred_lang = language.lower().strip() if language else None

        result = parse_voice_audio(
            audio_path=temp_audio,
            preferred_language=preferred_lang
        )
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Voice parsing error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Voice processing failed: {str(exc)}"
        )
    finally:
        if temp_audio and os.path.exists(temp_audio):
            try:
                os.remove(temp_audio)
            except Exception as cleanup_err:
                logger.warning(f"Failed to delete temp audio file {temp_audio}: {cleanup_err}")
