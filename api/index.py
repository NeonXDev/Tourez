"""api/index.py — Vercel Serverless Function entry point for Tourez FastAPI backend."""
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app as base_app
from main import health
from starlette.requests import Request
from starlette.responses import JSONResponse

@base_app.get("/health")
async def health_alias():
    return await health()

@base_app.get("/api/index.py")
async def index_py_health():
    return await health()

@base_app.api_route("/api/debug-path", methods=["GET", "POST"])
@base_app.api_route("/debug-path", methods=["GET", "POST"])
async def debug_path(request: Request):
    return JSONResponse({
        "url_path": request.url.path,
        "scope_path": request.scope.get("path"),
        "raw_path": request.scope.get("raw_path", b"").decode("utf-8", "ignore"),
        "forwarded_uri": request.headers.get("x-forwarded-uri"),
        "matched_path": request.headers.get("x-matched-path"),
    })

class VercelPathMiddleware:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            headers = dict(scope.get("headers", []))
            
            # 1. Check if Vercel provided the real incoming URI
            forwarded = headers.get(b"x-forwarded-uri", b"").decode("utf-8", "ignore")
            if forwarded:
                clean_path = forwarded.split("?")[0]
                if clean_path:
                    scope["path"] = clean_path

            # 2. If path is still /api/index.py or starts with it, normalize
            cur = scope.get("path", "")
            if cur.startswith("/api/index.py"):
                sub = cur[len("/api/index.py"):]
                scope["path"] = "/api" + (sub if sub.startswith("/") else "/" + sub) if sub else "/api/health"
            elif not cur.startswith("/api"):
                if cur.startswith("/index.py"):
                    cur = cur[len("/index.py"):]
                scope["path"] = "/api" + (cur if cur.startswith("/") else "/" + cur)

        await self.asgi_app(scope, receive, send)

app = VercelPathMiddleware(base_app)
