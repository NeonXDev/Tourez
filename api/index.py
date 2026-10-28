"""api/index.py — Vercel Serverless Function entry point for Tourez FastAPI backend."""
import sys
import os
import urllib.parse

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

            # 1. Check query string for _path (injected via vercel.json rewrite)
            qs_bytes = scope.get("query_string", b"")
            qs_str = qs_bytes.decode("utf-8", "ignore")
            target_path = None

            if "_path=" in qs_str:
                pairs = urllib.parse.parse_qsl(qs_str, keep_blank_values=True)
                new_pairs = []
                for k, v in pairs:
                    if k == "_path":
                        target_path = v
                    else:
                        new_pairs.append((k, v))
                scope["query_string"] = urllib.parse.urlencode(new_pairs).encode("utf-8")

            if target_path:
                clean = target_path.strip()
                if not clean.startswith("/"):
                    clean = "/" + clean
                if not clean.startswith("/api"):
                    clean = "/api" + clean
                scope["path"] = clean
            else:
                # 2. Check headers that Vercel might pass
                headers = dict(scope.get("headers", []))
                uri = (
                    headers.get(b"x-matched-path")
                    or headers.get(b"x-forwarded-uri")
                    or headers.get(b"x-now-route-matches")
                    or headers.get(b"x-vercel-matched-path")
                )
                if uri:
                    clean = uri.decode("utf-8", "ignore").split("?")[0]
                    if clean and not clean.endswith("index.py"):
                        scope["path"] = clean

            # If path ended up being index.py or /api/, normalize to /api/health
            if scope["path"] in ("/api/index.py", "/api/", "/api"):
                scope["path"] = "/api/health"

        await self.asgi_app(scope, receive, send)

app = VercelPathMiddleware(base_app)
