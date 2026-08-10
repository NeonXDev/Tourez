from datetime import datetime, timezone
from typing import Dict, Any

import httpx

from config import settings


def _describe_wmo(code: int, is_day: int = 1) -> tuple[str, str]:
    if code == 0:
        return ("Clear", "☀️" if is_day else "🌙")
    if code == 1:
        return ("Mainly Clear", "🌤️" if is_day else "🌙")
    if code == 2:
        return ("Partly Cloudy", "⛅")
    if code == 3:
        return ("Overcast", "☁️")
    if code in (45, 48):
        return ("Foggy", "🌫️")
    if code in (51, 53, 55):
        return ("Drizzle", "🌦️")
    if code in (56, 57):
        return ("Freezing Drizzle", "🌧️")
    if code in (61, 63, 65):
        return ("Rain", "🌧️")
    if code in (66, 67):
        return ("Freezing Rain", "🌧️")
    if code in (71, 73, 75, 77):
        return ("Snow", "❄️")
    if code in (80, 81, 82):
        return ("Rain Showers", "🌦️")
    if code in (85, 86):
        return ("Snow Showers", "🌨️")
    if code in (95, 96, 99):
        return ("Thunderstorm", "⛈️")
    return ("Variable", "🌤️")


def _demo_weather(lat: float, lon: float, location: str) -> Dict[str, Any]:
    """Deterministic fallback used only when USE_MOCK=true and live weather fails."""
    seed = int((abs(lat) * 1000 + abs(lon) * 1000) % 5)
    conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"]
    icons = ["☀️", "🌤️", "☁️", "🌦️", "🌙"]
    return {
        "location": location,
        "temp": 18 + seed,
        "feels_like": 17 + seed,
        "condition": conditions[seed],
        "icon": icons[seed],
        "humidity": 40 + seed * 10,
        "wind": 5 + seed * 3,
        "rain_chance": seed * 15,
        "forecast": [
            {"day": "Today", "icon": icons[(seed + 1) % 5], "high": 20 + seed, "low": 14 + seed, "condition": conditions[(seed + 1) % 5]},
            {"day": "Tomorrow", "icon": icons[(seed + 2) % 5], "high": 19 + seed, "low": 13 + seed, "condition": conditions[(seed + 2) % 5]},
            {"day": "Day 3", "icon": icons[(seed + 3) % 5], "high": 21 + seed, "low": 15 + seed, "condition": conditions[(seed + 3) % 5]},
        ],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "demo-fallback",
    }


def _day_label(date_str: str, index: int) -> str:
    if index == 0:
        return "Today"
    if index == 1:
        return "Tomorrow"
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
    except Exception:
        return f"Day {index + 1}"


def _build_daily(data: Dict[str, Any]) -> list[Dict[str, Any]]:
    daily = data.get("daily") or {}
    times = daily.get("time") or []
    highs = daily.get("temperature_2m_max") or []
    lows = daily.get("temperature_2m_min") or []
    codes = daily.get("weather_code") or []
    rain_probs = daily.get("precipitation_probability_max") or []

    out: list[Dict[str, Any]] = []
    for i, date_str in enumerate(times[:5]):
        code = int(codes[i] if i < len(codes) and codes[i] is not None else 0)
        condition, icon = _describe_wmo(code, 1)
        out.append({
            "day": _day_label(date_str, i),
            "icon": icon,
            "high": round(float(highs[i]), 1) if i < len(highs) and highs[i] is not None else 0,
            "low": round(float(lows[i]), 1) if i < len(lows) and lows[i] is not None else 0,
            "condition": condition,
            "rain_chance": int(round(float(rain_probs[i]))) if i < len(rain_probs) and rain_probs[i] is not None else 0,
        })
    return out


async def _fetch_open_meteo(lat: float, lon: float, location: str) -> Dict[str, Any]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "auto",
        "forecast_days": 5,
    }
    headers = {"User-Agent": settings.osm_user_agent}
    async with httpx.AsyncClient(timeout=6, headers=headers, follow_redirects=True) as client:
        response = await client.get(settings.open_meteo_url, params=params)
        response.raise_for_status()
        data = response.json()

    current = data.get("current") or {}
    code = int(current.get("weather_code") or 0)
    is_day = int(current.get("is_day") if current.get("is_day") is not None else 1)
    condition, icon = _describe_wmo(code, is_day)
    forecast = _build_daily(data)
    rain_chance = 0
    daily = data.get("daily") or {}
    rain_probs = daily.get("precipitation_probability_max") or []
    if rain_probs and rain_probs[0] is not None:
        rain_chance = int(round(float(rain_probs[0])))

    return {
        "location": location or "Current location",
        "temp": round(float(current.get("temperature_2m") or 0), 1),
        "feels_like": round(float(current.get("apparent_temperature") or current.get("temperature_2m") or 0), 1),
        "condition": condition,
        "icon": icon,
        "humidity": int(round(float(current.get("relative_humidity_2m") or 0))),
        "wind": round(float(current.get("wind_speed_10m") or 0), 1),
        "rain_chance": rain_chance,
        "forecast": forecast,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Open-Meteo",
    }


async def get_weather(lat: float, lon: float, location: str = "") -> Dict[str, Any]:
    try:
        return await _fetch_open_meteo(lat, lon, location)
    except Exception:
        if settings.use_mock:
            return _demo_weather(lat, lon, location or "Current location")
        raise
