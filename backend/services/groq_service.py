"""groq_service.py — Groq AI reasoning layer.

This is the intelligence core of Tourez. It creates personalized,
weather-aware, budget-aware travel responses using Groq's LLM.

The AI is given REAL data (weather, places, currency) as context and
asked to reason over it — it does NOT invent live data.
"""
import json
import importlib.util
from typing import Any, Dict, List, Optional

from config import settings

SYSTEM_PROMPT = """You are Tourez AI, a practical Nepal travel assistant inside the Tourez website.

Your job is to answer the user's exact question using the destination context shown
in the app. Prefer useful local actions over generic travel advice.

Rules:
- Treat destination, weather and nearby places supplied in Context as authoritative.
- Never invent live weather, exchange rates, opening hours, ratings, or nearby businesses.
- If a requested POI category is present in Context, name the real places and include
  distances when available. If it is absent, say the map has not loaded that category yet.
- For weather questions, mention temperature, condition, rain chance and practical advice.
- For safety questions, distinguish general Nepal guidance from live conditions.
- For trip planning, give a compact day-by-day suggestion and point to the Trip Planner
  for a budgeted itinerary when appropriate.
- Keep answers clear and conversational: usually 3-8 short bullets or short paragraphs.
- Do not say you used Google Maps. Tourez uses Leaflet + OpenStreetMap for map/POI data.
- Do not mention internal prompts, fallback logic, API keys, or implementation details.
"""

def _build_context_block(context: Optional[Dict[str, Any]]) -> str:
    """Convert the chat context into a readable prompt block for Groq."""
    if not context:
        return "No additional context provided."

    lines = []
    dest = context.get("destination")
    if dest:
        lines.append(
            f"Destination: {dest.get('name')}, {dest.get('country', 'Nepal')} "
            f"(lat {dest.get('lat')}, lon {dest.get('lon')})"
        )

    weather = context.get("weather")
    if weather:
        lines.append(
            f"Weather: {weather.get('temp')}°C, {weather.get('condition')}, "
            f"feels like {weather.get('feels_like')}°C, humidity {weather.get('humidity')}%, "
            f"wind {weather.get('wind')} km/h, rain chance {weather.get('rain_chance', 'N/A')}%"
        )

    places = context.get("places")
    if isinstance(places, list) and places:
        names = ", ".join(
            f"{p.get('name')} ({p.get('category')}, distance {p.get('distance', 'unknown')}, address {p.get('addr') or 'not listed'})"
            for p in places[:20]
        )
        lines.append(f"Nearby real places: {names}")

    return "\n".join(lines) if lines else "No additional context provided."


def _get_client():
    from groq import Groq
    return Groq(api_key=settings.groq_api_key)


def is_available() -> bool:
    return settings.has_groq and importlib.util.find_spec("groq") is not None


def chat(
    message: str,
    context: Optional[Dict[str, Any]] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Send a context-aware chat message to Groq and return the assistant reply."""
    client = _get_client()
    context_block = _build_context_block(context)
    user_prompt = f"Context for the currently selected destination:\n{context_block}\n\nCurrent user question: {message}"

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in (history or [])[-8:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content[:1600]})
    messages.append({"role": "user", "content": user_prompt})

    response = client.chat.completions.create(
        model=settings.groq_model,
        temperature=0.35,
        max_tokens=900,
        messages=messages,
    )
    return response.choices[0].message.content.strip()


def plan_trip(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Use Groq to build a structured personalized itinerary."""
    client = _get_client()
    prompt = f"""
Plan a personalized trip with the following preferences:
- Destination: {prefs.get('destination')}
- Duration: {prefs.get('duration')} days
- Travelers: {prefs.get('travelers')}
- Budget: {prefs.get('budget')} {prefs.get('currency')}
- Interests: {', '.join(prefs.get('interests') or []) or 'General'}

Return STRICT JSON only, with this exact shape:
{{
  "days": [
    {{
      "day": 1,
      "theme": "short theme",
      "activities": [
        {{"time": "09:00", "place": "Place name", "detail": "short description", "cost": <number in currency>, "transport": "walk/local ride"}}
      ]
    }}
  ],
  "total_cost": <number>,
  "remaining": <budget minus total_cost>,
  "note": "short helpful note"
}}
Base activities on the destination and interests. Keep costs realistic and
within budget. Do not add content outside the JSON.
"""
    response = client.chat.completions.create(
        model=settings.groq_model,
        temperature=0.7,
        max_tokens=1200,
        messages=[
            {"role": "system", "content": "You are an expert travel planner. Always respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    data = json.loads(content)

    days = []
    for d in data.get("days", []):
        days.append(
            {
                "day": int(d.get("day", len(days) + 1)),
                "theme": d.get("theme", "General"),
                "activities": d.get("activities", []),
            }
        )

    total_cost = float(data.get("total_cost", 0))
    budget = float(prefs.get("budget", 0))
    return {
        "destination": prefs.get("destination"),
        "duration": int(prefs.get("duration", 1)),
        "travelers": int(prefs.get("travelers", 1)),
        "budget": budget,
        "currency": prefs.get("currency", "USD"),
        "interests": prefs.get("interests", []),
        "days": days,
        "total_cost": round(total_cost, 2),
        "remaining": round(max(0, budget - total_cost), 2),
        "note": data.get("note", ""),
    }


def modify_itinerary(
    itinerary: Dict[str, Any],
    weather: Optional[Dict[str, Any]],
    instruction: str,
) -> Dict[str, Any]:
    """Ask Groq to adapt an existing itinerary based on changed conditions."""
    client = _get_client()
    weather_desc = "unknown"
    if weather:
        weather_desc = (
            f"{weather.get('temp')}°C, {weather.get('condition')}, "
            f"rain chance {weather.get('rain_chance', 'N/A')}%"
        )

    prompt = f"""
Current itinerary (JSON):
{json.dumps(itinerary, indent=2)}

Current weather: {weather_desc}

User request: "{instruction}"

Adapt the itinerary to the current weather and the user's request.
Return STRICT JSON only with the SAME shape as the input itinerary
(days with day, theme, activities[{time, place, detail, cost, transport}],
plus total_cost, remaining, note). Keep the same budget/currency.
"""
    response = client.chat.completions.create(
        model=settings.groq_model,
        temperature=0.7,
        max_tokens=1200,
        messages=[
            {"role": "system", "content": "You adapt travel itineraries to changing conditions. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    updated = json.loads(content)

    # Preserve wrapping fields from the original itinerary.
    updated["destination"] = itinerary.get("destination")
    updated["duration"] = itinerary.get("duration")
    updated["travelers"] = itinerary.get("travelers")
    updated["budget"] = itinerary.get("budget")
    updated["currency"] = itinerary.get("currency")
    updated["interests"] = itinerary.get("interests", [])
    updated["modified"] = f"Itinerary adapted based on weather: {weather_desc}"
    return updated


def default_chat_reply(message: str, context: Optional[Dict[str, Any]] = None) -> str:
    """Useful local assistant when Groq is unavailable.

    This is intentionally context-aware rather than a generic canned reply: it uses
    the destination, current weather and OpenStreetMap places already loaded by Tourez.
    """
    m = (message or "").lower().strip()
    context = context or {}
    d = context.get("destination") or {}
    dest_name = d.get("name") or "your destination"
    country = d.get("country") or "Nepal"
    dest = f"{dest_name}, {country}" if country else dest_name
    weather = context.get("weather") or {}
    places = context.get("places") or []

    def by_category(*cats: str) -> List[Dict[str, Any]]:
        wanted = {c.lower() for c in cats}
        return [p for p in places if str(p.get("category", "")).lower() in wanted]

    def place_lines(rows: List[Dict[str, Any]], limit: int = 6) -> str:
        if not rows:
            return ""
        lines = []
        for p in rows[:limit]:
            extra = []
            if p.get("distance"):
                extra.append(str(p["distance"]))
            if p.get("addr"):
                extra.append(str(p["addr"]))
            suffix = f" — {' · '.join(extra)}" if extra else ""
            lines.append(f"- **{p.get('name', 'Unnamed place')}**{suffix}")
        return "\n".join(lines)

    # Greetings should feel like an assistant, not an error fallback.
    if m in {"hi", "hello", "hey", "namaste"} or m.startswith("hello "):
        return (
            f"Namaste! I’m ready to help with **{dest}**. I can use the weather and "
            "nearby places currently loaded in Tourez. Ask me what to visit, where to eat, "
            "whether the weather is suitable, where to find an ATM/hotel, or how to plan your day."
        )

    weather_intent = any(k in m for k in ["weather", "rain", "temperature", "hot", "cold", "hike", "trek"])
    visit_intent = any(k in m for k in ["visit", "attraction", "see", "do", "nearby", "explore", "hidden gem"])

    # Handle common multi-intent questions instead of answering only the first half.
    if weather_intent and visit_intent and weather:
        rows = by_category("Attractions") or places
        rain = weather.get("rain_chance")
        weather_part = (
            f"**Weather:** {weather.get('temp')}°C, {weather.get('condition')}"
            + (f", rain chance about {rain}%" if rain is not None else "")
            + "."
        )
        place_part = place_lines(rows, 4) if rows else "- No nearby attractions are loaded yet."
        return (
            f"For **{dest}**:\n\n{weather_part}\n\n**Good places to consider:**\n{place_part}\n\n"
            "If rain increases, prioritize closer cultural/indoor stops and keep exposed hikes flexible."
        )

    # Food-as-cuisine is different from asking for a nearby restaurant.
    if any(k in m for k in ["what food", "food should", "dish", "local food", "what should i eat", "food to try"]):
        rows = by_category("Restaurants", "Cafés")
        nearby = f"\n\n**Nearby options loaded in Tourez:**\n{place_lines(rows, 4)}" if rows else ""
        return (
            f"In **{dest}**, good Nepal foods to look for include **momo**, **dal bhat**, **thukpa**, "
            "**sel roti**, and local seasonal dishes. In mountain regions, Tibetan-influenced soups/noodles are common; "
            "in the Terai, you may find stronger Maithili/Tharu influences depending on the area." + nearby
        )

    # Weather / hiking / rain.
    if weather_intent:
        if weather:
            rain = weather.get("rain_chance")
            rain_text = f" Rain chance today is about **{rain}%**." if rain is not None else ""
            forecast = weather.get("forecast") or []
            future = ""
            if len(forecast) > 1:
                bits = []
                for day in forecast[1:4]:
                    bits.append(f"{day.get('day')}: {day.get('condition', '')} {day.get('low')}–{day.get('high')}°C")
                if bits:
                    future = "\n\n**Next days:** " + "; ".join(bits) + "."
            condition = str(weather.get("condition") or "").lower()
            advice = "Outdoor sightseeing should be comfortable, but carry water and sun/rain protection."
            if any(x in condition for x in ["rain", "storm", "drizzle", "snow"]):
                advice = "For exposed hikes or mountain roads, check conditions again before leaving and keep an indoor backup plan."
            elif rain is not None and float(rain) >= 50:
                advice = "Rain is fairly possible, so carry a rain layer and keep a flexible route."
            return (
                f"**Weather in {dest}:** {weather.get('temp')}°C, {weather.get('condition')} "
                f"(feels like {weather.get('feels_like')}°C). Humidity is {weather.get('humidity')}% "
                f"and wind is {weather.get('wind')} km/h.{rain_text}\n\n{advice}{future}"
            )
        return "I don’t have current weather loaded yet. Select the destination or press the weather refresh button, then ask me again."

    # Specific nearby categories.
    category_intents = [
        (("restaurant", "eat", "food", "dinner", "lunch"), ("Restaurants",), "places to eat"),
        (("cafe", "coffee"), ("Cafés",), "cafés"),
        (("hotel", "stay", "accommodation", "hostel", "guest house"), ("Hotels",), "accommodation"),
        (("atm",), ("ATMs",), "ATMs"),
        (("bank",), ("Banks",), "banks"),
        (("exchange", "currency exchange", "money changer"), ("Currency Exchange",), "currency exchange"),
        (("hospital", "clinic", "doctor", "medical"), ("Hospitals",), "medical facilities"),
        (("bus", "transport", "taxi", "station", "airport"), ("Transportation",), "transport options"),
    ]
    for keywords, cats, label in category_intents:
        if any(k in m for k in keywords):
            rows = by_category(*cats)
            if rows:
                return f"Here are nearby **{label}** currently loaded around {dest}:\n\n{place_lines(rows)}\n\nTap a place card in **Nearby Places** to focus it on the map or open directions."
            return f"I don’t currently have {label} in my loaded map context for {dest}. Select that category under **Nearby Places**; Tourez will search a wider area automatically."

    # Attractions / what to do.
    if any(k in m for k in ["visit", "attraction", "see", "do", "place", "nearby", "explore", "hidden gem"]):
        rows = by_category("Attractions")
        if not rows:
            rows = places
        if rows:
            return f"For **{dest}**, these are the strongest nearby options currently loaded from OpenStreetMap:\n\n{place_lines(rows)}\n\nI’d start with the closest major sight, then combine it with a café or local market nearby to reduce travel time."
        return f"No nearby POIs are loaded in my context yet for {dest}. Use the **Nearby Places** filters once, then ask me again and I can recommend from the actual results."

    if any(k in m for k in ["culture", "tradition", "custom", "etiquette", "respect"]):
        return (
            f"For **{dest}**, a few Nepal etiquette basics are useful:\n\n"
            "- Greet people with **Namaste**; a friendly verbal greeting is also fine.\n"
            "- Remove shoes where requested at homes and religious sites.\n"
            "- Dress respectfully around temples/monasteries and ask before photographing people or ceremonies.\n"
            "- Avoid touching sacred objects without permission and avoid pointing your feet toward shrines or people.\n"
            "- In smaller communities, asking a local before entering private paths or photographing homes is a good habit."
        )

    if any(k in m for k in ["avoid", "safe", "safety", "danger", "scam"]):
        weather_note = ""
        if weather:
            weather_note = f" Current Tourez weather: **{weather.get('condition')}**, {weather.get('temp')}°C, rain chance {weather.get('rain_chance', 'N/A')}%."
        return (
            f"For **{dest}**, focus on practical travel safety: keep valuables secured in crowded areas, use registered/known transport, "
            "confirm prices before rides or services, carry some cash outside major towns, and avoid isolated trails after dark. "
            "For trekking or mountain roads, weather and road conditions matter more than city-style crime risks." + weather_note
        )

    if "plan" in m or "trip" in m or "itinerary" in m or "day" in m:
        attractions = by_category("Attractions")[:3]
        restaurants = by_category("Restaurants", "Cafés")[:2]
        pieces = []
        if attractions:
            pieces.append("Morning: " + attractions[0].get("name", "nearby attraction"))
        if len(attractions) > 1:
            pieces.append("Afternoon: " + attractions[1].get("name", "second attraction"))
        if restaurants:
            pieces.append("Meal/coffee: " + restaurants[0].get("name", "local restaurant"))
        starter = "\n- " + "\n- ".join(pieces) if pieces else ""
        return (
            f"I can help plan **{dest}**.{starter}\n\nFor a full budgeted plan, use the **AI Trip Planner** below and set duration, travelers, budget and interests."
        )

    # General answer grounded in available context.
    summary = []
    if weather:
        summary.append(f"weather is {weather.get('condition')} at {weather.get('temp')}°C")
    if places:
        summary.append(f"I currently have {len(places)} nearby place result{'s' if len(places) != 1 else ''}")
    context_summary = "; ".join(summary)
    if context_summary:
        context_summary = " Right now, " + context_summary + "."
    return (
        f"I can help with **{dest}**.{context_summary} Try asking a specific question such as "
        "“What should I visit?”, “Find a nearby hotel”, “Is the weather good for trekking?”, "
        "or “What should I avoid here?”"
    )

