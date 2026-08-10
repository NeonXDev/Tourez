from typing import Dict, Any

import httpx
from fastapi import APIRouter

from config import settings
from schemas import TranslateRequest, TranslateResponse

router = APIRouter(prefix="/api/translate", tags=["translate"])


async def translate(text: str, target_lang: str, source_lang: str = "auto") -> Dict[str, Any]:
    url = f"{settings.libretranslate_url}/translate"
    payload = {
        "q": text,
        "source": source_lang,
        "target": target_lang,
        "format": "text",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return {"translation": data.get("translatedText", text), "source": "libretranslate"}
    except Exception:
        # Return original text as a graceful fallback.
        return {"translation": text, "source": "fallback"}
