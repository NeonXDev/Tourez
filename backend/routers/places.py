"""places.py — GET /api/places endpoint."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from schemas import PlaceOut
from services import places_service

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("", response_model=List[PlaceOut])
async def get_places(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    category: Optional[str] = Query(None, description="Place category filter"),
):
    """Fetch nearby places for a location, optionally filtered by category."""
    try:
        return await places_service.get_places(lat, lon, category)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Places unavailable: {e}")
