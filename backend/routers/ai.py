"""ai.py — AI endpoints: chat, plan trip, modify itinerary.

Uses the Groq reasoning layer. If Groq is not configured, falls back to
demo responses so the app remains testable end-to-end.
"""
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from schemas import (
    ChatRequest, ChatResponse, PlanRequest, ItineraryOut,
    ModifyRequest, ModifyResponse,
)
from services import groq_service
from config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Map our frontend's camelCase weather fields to what Groq expects.
def _normalize_weather(weather: Dict[str, Any]) -> Dict[str, Any]:
    if not weather:
        return {}
    return {
        "temp": weather.get("temp"),
        "feels_like": weather.get("feels_like", weather.get("feelsLike")),
        "condition": weather.get("condition"),
        "humidity": weather.get("humidity"),
        "wind": weather.get("wind"),
        "rain_chance": weather.get("rain_chance", weather.get("rainChance")),
        "forecast": weather.get("forecast") or [],
        "source": weather.get("source"),
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """AI chat endpoint. Sends message + context to Groq."""
    context = req.context.model_dump() if req.context else None
    if context and context.get("weather"):
        context["weather"] = _normalize_weather(context["weather"])
    try:
        if groq_service.is_available():
            reply = groq_service.chat(req.message, context, req.history)
        else:
            reply = groq_service.default_chat_reply(req.message, context)
        return ChatResponse(message=reply)
    except Exception:
        # Graceful fallback — never crash the whole app.
        reply = groq_service.default_chat_reply(req.message, context)
        return ChatResponse(message=reply)


@router.post("/plan", response_model=ItineraryOut)
async def plan_trip(req: PlanRequest):
    """Plan a personalized itinerary using Groq + real context."""
    prefs = {
        "destination": req.destination,
        "duration": req.duration,
        "travelers": req.travelers,
        "budget": req.budget,
        "currency": req.currency,
        "interests": req.interests,
        "lat": req.lat,
        "lon": req.lon,
    }
    try:
        if groq_service.is_available():
            return groq_service.plan_trip(prefs)
        # Demo fallback itinerary.
        return _demo_itinerary(prefs)
    except Exception as e:
        if settings.use_mock:
            return _demo_itinerary(prefs)
        raise HTTPException(status_code=502, detail=f"AI planning failed: {e}")


@router.post("/modify-itinerary", response_model=ModifyResponse)
async def modify_itinerary(req: ModifyRequest):
    """Modify an itinerary based on changing conditions (e.g. weather)."""
    weather_norm = _normalize_weather(req.weather or {})
    try:
        if groq_service.is_available():
            updated = groq_service.modify_itinerary(
                req.itinerary, weather_norm, req.instruction
            )
            return ModifyResponse(itinerary=updated, modified=updated.get("modified"))
        # Demo fallback.
        updated = _demo_modify(req.itinerary, req.weather or {}, req.instruction)
        return ModifyResponse(itinerary=updated, modified=updated.get("modified"))
    except Exception as e:
        if settings.use_mock:
            updated = _demo_modify(req.itinerary, req.weather or {}, req.instruction)
            return ModifyResponse(itinerary=updated, modified=updated.get("modified"))
        raise HTTPException(status_code=502, detail=f"AI modification failed: {e}")


# ----------------------------------------------------------------
# Demo fallbacks (used only when Groq is unavailable)
# ----------------------------------------------------------------
def _demo_itinerary(prefs: Dict[str, Any]) -> Dict[str, Any]:
    themes = prefs.get("interests") or ["Nature", "Culture", "Food"]
    duration = int(prefs.get("duration", 3))
    budget = float(prefs.get("budget", 300))
    days = []
    pools = {
        "Nature": {"place": "Lakeside trails", "cost": 15, "icon": "🌲"},
        "Food": {"place": "Local food tour", "cost": 20, "icon": "🍜"},
        "Culture": {"place": "Heritage & temple sites", "cost": 12, "icon": "🏛️"},
        "History": {"place": "Museum & old town", "cost": 10, "icon": "📜"},
        "Adventure": {"place": "Adventure activity", "cost": 40, "icon": "🧗"},
        "Shopping": {"place": "Local market", "cost": 25, "icon": "🛍️"},
        "Photography": {"place": "Sunrise viewpoint", "cost": 8, "icon": "📷"},
        "Relaxation": {"place": "Spa & lakeside café", "cost": 18, "icon": "🌅"},
    }
    for i in range(duration):
        theme = themes[i % len(themes)]
        acts = []
        times = ["09:00", "12:30", "16:00"]
        for j in range(3):
            item = pools.get(theme) or pools[list(pools)[j % len(pools)]]
            acts.append({
                "time": times[j],
                "place": item["place"],
                "detail": f"{item['icon']} {item['place']} — a {theme} experience in {prefs.get('destination')}.",
                "cost": item["cost"],
                "transport": "Walk / local transport" if j == 0 else "Short local ride",
            })
        days.append({"day": i + 1, "theme": theme, "activities": acts})
    total = sum(a["cost"] for d in days for a in d["activities"]) * int(prefs.get("travelers", 1))
    return {
        "destination": prefs.get("destination"),
        "duration": duration,
        "travelers": int(prefs.get("travelers", 1)),
        "budget": budget,
        "currency": prefs.get("currency", "USD"),
        "interests": prefs.get("interests", []),
        "days": days,
        "total_cost": round(total, 2),
        "remaining": round(max(0, budget - total), 2),
        "note": "Demo itinerary (Groq unavailable). Connect GROQ_API_KEY for AI-generated plans.",
    }


def _demo_modify(itinerary: Dict[str, Any], weather: Dict[str, Any], instruction: str) -> Dict[str, Any]:
    import copy
    updated = copy.deepcopy(itinerary)
    cond = (weather.get("condition") or "").lower()
    if "rain" in cond and updated.get("days") and len(updated["days"]) > 1:
        updated["days"][1]["theme"] = "Indoor & Cultural"
        updated["days"][1]["activities"] = [
            {"time": "09:30", "place": "Indoor museum", "detail": "🏛️ Explore the museum — perfect for a rainy day.", "cost": 10, "transport": "Walk"},
            {"time": "12:30", "place": "Local café", "detail": "🍜 Enjoy local food and warm drinks while it rains.", "cost": 15, "transport": "Walk"},
            {"time": "15:00", "place": "Cultural gallery", "detail": "🎨 Indoor cultural exhibits and artisan workshops.", "cost": 12, "transport": "Short ride"},
        ]
        updated["modified"] = "Day 2 was adapted to indoor activities due to the rain forecast."
    else:
        updated["modified"] = "Based on current conditions, your plan remains suitable for the weather."
    return updated
