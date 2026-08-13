"""main.py — Tourez FastAPI backend entry point.

Architecture:
    Browser → JS frontend → FastAPI (this app) → External APIs
                                    ↓
                                OpenAI (reasoning layer)

Run:
    uvicorn main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import destination, weather, places, ai, currency, translate
from services import openai_service

app = FastAPI(
    title="Tourez Backend API",
    description="AI-powered smart tourism backend. Combines real weather, places, "
                "and currency data with OpenAI for personalized travel decisions.",
    version="2.0.0",
)

# CORS — allow the static frontend (Vercel / local) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "Tourez Backend",
        "openai": openai_service.is_available(),
        "map_provider": "Leaflet + OpenStreetMap",
        "weather": "Open-Meteo",
        "use_mock": settings.use_mock,
    }

# Mount routers
app.include_router(destination.router)
app.include_router(weather.router)
app.include_router(places.router)
app.include_router(ai.router)
app.include_router(currency.router)
app.include_router(translate.router)

# Root
@app.get("/")
async def root():
    return {
        "message": "Welcome to the Tourez Backend API 🌍",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": [
            "GET  /api/destination?q=",
            "GET  /api/destination/{id}",
            "GET  /api/weather?lat=&lon=",
            "GET  /api/places?lat=&lon=&category=",
            "POST /api/ai/chat",
            "POST /api/ai/plan",
            "POST /api/ai/modify-itinerary",
            "GET  /api/currency?amount=&from=&to=",
            "POST /api/translate",
        ],
    }
