"""translate.py — POST /api/translate endpoint."""
from fastapi import APIRouter

from schemas import TranslateRequest, TranslateResponse
from services import translate_service

router = APIRouter(prefix="/api/translate", tags=["translate"])


@router.post("", response_model=TranslateResponse)
async def translate_text(req: TranslateRequest):
    """Translate text to a target language using LibreTranslate."""
    try:
        result = await translate_service.translate(req.text, req.target_lang, req.source_lang)
        return TranslateResponse(translation=result["translation"])
    except Exception as e:
        return TranslateResponse(translation=req.text)
