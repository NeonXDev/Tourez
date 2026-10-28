"""api/index.py — Vercel Serverless Function entry point for Tourez FastAPI backend."""
import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app  # ASGI app exposed for Vercel Python runtime
