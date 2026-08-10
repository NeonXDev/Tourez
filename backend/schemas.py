"""schemas.py — Pydantic models defining the API request/response contracts.

These mirror exactly what the frontend (js/services.js + ui.js + currency.js)
expects. The frontend uses camelCase field names, so we use Pydantic aliases
to serialize responses in camelCase while keeping Python snake_case internally.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    """Base model that serializes with camelCase aliases."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=lambda s: _to_camel(s))


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


# ============================================================
# Destination
# ============================================================
class DestinationOut(CamelModel):
    id: str
    name: str
    country: str
    lat: float
    lon: float
    description: Optional[str] = None
    best_time: Optional[List[str]] = Field(default=None, alias="bestTime")
    popular_attractions: Optional[List[str]] = Field(default=None, alias="popularAttractions")


# ============================================================
# Weather
# ============================================================
class WeatherForecastDay(CamelModel):
    day: str
    icon: str
    high: float
    low: float
    condition: Optional[str] = None
    rain_chance: Optional[int] = Field(default=None, alias="rainChance")


class WeatherOut(CamelModel):
    location: str
    temp: float
    feels_like: float = Field(alias="feelsLike")
    condition: str
    icon: str
    humidity: int
    wind: float
    rain_chance: Optional[int] = Field(default=None, alias="rainChance")
    forecast: List[WeatherForecastDay]
    updated_at: str = Field(alias="updatedAt")
    source: Optional[str] = None


# ============================================================
# Places
# ============================================================
class PlaceOut(CamelModel):
    id: str
    name: str
    category: str
    icon: Optional[str] = None
    lat: float
    lon: float
    addr: Optional[str] = None
    rating: Optional[str] = None
    distance: Optional[str] = None
    open_now: Optional[bool] = Field(default=None, alias="openNow")
    photo: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


# ============================================================
# AI chat
# ============================================================
class ChatContext(BaseModel):
    destination: Optional[Dict[str, Any]] = None
    weather: Optional[Dict[str, Any]] = None
    places: Optional[List[Dict[str, Any]]] = None


class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None
    history: List[Dict[str, str]] = Field(default_factory=list)


class ChatResponse(CamelModel):
    message: str


# ============================================================
# Trip Planner
# ============================================================
class PlanRequest(BaseModel):
    destination: str = "Pokhara"
    duration: int = 3
    travelers: int = 2
    budget: float = 300
    currency: str = "USD"
    interests: List[str] = Field(default_factory=list)
    lat: Optional[float] = None
    lon: Optional[float] = None


class ItineraryActivity(CamelModel):
    time: str
    place: str
    detail: str
    cost: float
    transport: str


class ItineraryDay(CamelModel):
    day: int
    theme: str
    activities: List[ItineraryActivity]


class ItineraryOut(CamelModel):
    destination: str
    duration: int
    travelers: int
    budget: float
    currency: str
    interests: List[str]
    days: List[ItineraryDay]
    total_cost: float = Field(alias="totalCost")
    remaining: float
    note: Optional[str] = None
    generated_with: Optional[str] = Field(default=None, alias="generatedWith")


# ============================================================
# Modify Itinerary
# ============================================================
class ModifyRequest(BaseModel):
    itinerary: Dict[str, Any]
    weather: Optional[Dict[str, Any]] = None
    instruction: str = ""


class ModifyResponse(CamelModel):
    itinerary: Dict[str, Any]
    modified: Optional[str] = None


# ============================================================
# Currency
# ============================================================
class CurrencyOut(CamelModel):
    amount: float
    from_currency: str = Field(alias="fromCurrency")
    to_currency: str = Field(alias="toCurrency")
    rate: float
    converted: float
    updated_at: str = Field(alias="updatedAt")
    source: Optional[str] = None


# ============================================================
# Translation
# ============================================================
class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "en"
    source_lang: str = "auto"


class TranslateResponse(CamelModel):
    translation: str
