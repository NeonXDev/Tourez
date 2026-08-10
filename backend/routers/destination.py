"""destination.py — GET /api/destination endpoints."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException

from schemas import DestinationOut
from services import destination_service

router = APIRouter(prefix="/api/destination", tags=["destination"])


@router.get("", response_model=List[DestinationOut])
async def search_destinations(q: str = ""):
    """Search destinations by name. Returns matching destinations."""
    try:
        return await destination_service.search(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dest_id}", response_model=DestinationOut)
async def get_destination(dest_id: str):
    """Get a single destination by id."""
    dest = destination_service.get_by_id(dest_id)
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    return dest
