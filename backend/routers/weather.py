"""weather.py — GET /api/weather endpoint."""
from fastapi import APIRouter, HTTPException, Query

from schemas import WeatherOut
from services import weather_service

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=WeatherOut)
async def get_weather(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    location: str = Query("", description="Display location name"),
):
    """Fetch current weather and forecast for coordinates."""
    try:
        return await weather_service.get_weather(lat, lon, location)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather unavailable: {e}")
