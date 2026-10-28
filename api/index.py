"""api/index.py — Vercel Serverless Function entry point for Tourez FastAPI backend."""
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app as base_app
from config import settings
from services import openai_service
from starlette.requests import Request

@base_app.get("/api/health")
@base_app.get("/health")
@base_app.get("/api/index.py")
async def health_debug(request: Request):
    x_headers = {
        k.decode("utf-8", "ignore"): v.decode("utf-8", "ignore")
        for k, v in request.scope.get("headers", [])
        if b"x-" in k.lower() or b"url" in k.lower() or b"path" in k.lower()
    }
    return {
        "status": "ok",
        "service": "Tourez Backend",
        "ai_provider": settings.ai_provider,
        "gemini": settings.has_gemini,
        "openai": settings.has_openai,
        "ai_available": openai_service.is_available(),
        "map_provider": "Leaflet + OpenStreetMap",
        "weather": "Open-Meteo",
        "use_mock": settings.use_mock,
        "original_path": request.scope.get("original_path"),
        "scope_path": request.scope.get("path"),
        "headers": x_headers,
    }

class VercelPathMiddleware:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            scope["original_path"] = scope.get("path")
            headers = dict(scope.get("headers", []))

            # Check all possible headers Vercel might use for the rewritten path
            uri = (
                headers.get(b"x-matched-path")
                or headers.get(b"x-forwarded-uri")
                or headers.get(b"x-now-route-matches")
                or headers.get(b"x-vercel-matched-path")
            )
            if uri:
                clean = uri.decode("utf-8", "ignore").split("?")[0]
                if clean:
                    scope["path"] = clean

        await self.asgi_app(scope, receive, send)

app = VercelPathMiddleware(base_app)
