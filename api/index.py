"""api/index.py — Vercel Serverless Function entry point for Tourez FastAPI backend."""
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app as base_app
from starlette.responses import JSONResponse

@base_app.get("/health")
async def health_alias():
    from main import health
    return await health()

@base_app.api_route("/api/debug-path", methods=["GET", "POST"])
@base_app.api_route("/debug-path", methods=["GET", "POST"])
async def debug_path(request):
    return JSONResponse({
        "url_path": request.url.path,
        "scope_path": request.scope.get("path"),
        "raw_path": request.scope.get("raw_path", b"").decode("utf-8", "ignore"),
        "headers": dict(request.headers),
    })

class VercelPathMiddleware:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            # If path arrives without /api (e.g. /health, /weather, /destination), add /api
            if not path.startswith("/api"):
                if path.startswith("/index.py"):
                    path = path[len("/index.py"):]
                if not path.startswith("/api"):
                    scope["path"] = "/api" + (path if path.startswith("/") else "/" + path)
            elif path.startswith("/api/api/"):
                scope["path"] = path[4:]
        await self.asgi_app(scope, receive, send)

app = VercelPathMiddleware(base_app)
