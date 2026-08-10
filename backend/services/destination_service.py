"""Destination search using OpenStreetMap Nominatim with a Nepal fallback registry."""
from typing import Dict, Any, List, Optional

import httpx

from config import settings


_REGISTRY = [
    {"id": "pokhara", "name": "Pokhara", "country": "Nepal", "lat": 28.2096, "lon": 83.9856,
     "description": "Adventure capital of Nepal, set beside Phewa Lake with views of the Annapurna range.",
     "best_time": ["Oct", "Nov", "Mar", "Apr"], "popular_attractions": ["Phewa Lake", "Sarangkot", "World Peace Pagoda"]},
    {"id": "kathmandu", "name": "Kathmandu", "country": "Nepal", "lat": 27.7172, "lon": 85.3240,
     "description": "Capital and cultural heart of Nepal, home to temples, stupas, and vibrant markets.",
     "best_time": ["Oct", "Nov", "Mar", "Apr"], "popular_attractions": ["Swayambhunath", "Boudhanath", "Patan Durbar Square"]},
    {"id": "chitwan", "name": "Chitwan", "country": "Nepal", "lat": 27.5291, "lon": 84.3544,
     "description": "Home to Chitwan National Park and rich wildlife safari experiences.",
     "best_time": ["Oct", "Nov", "Feb", "Mar", "Apr"], "popular_attractions": ["Chitwan National Park", "Rapti River", "Sauraha"]},
    {"id": "lumbini", "name": "Lumbini", "country": "Nepal", "lat": 27.4798, "lon": 83.2760,
     "description": "Birthplace of Lord Buddha and a UNESCO World Heritage pilgrimage destination.",
     "best_time": ["Oct", "Nov", "Feb", "Mar"], "popular_attractions": ["Maya Devi Temple", "Sacred Garden", "World Peace Pagoda"]},
    {"id": "mustang", "name": "Mustang", "country": "Nepal", "lat": 28.7839, "lon": 83.7300,
     "description": "Trans-Himalayan region known for dramatic landscapes, monasteries, and ancient culture.",
     "best_time": ["Apr", "May", "Sep", "Oct"], "popular_attractions": ["Muktinath", "Jomsom", "Upper Mustang"]},
    {"id": "illam", "name": "Ilam", "country": "Nepal", "lat": 26.9100, "lon": 87.9260,
     "description": "Eastern Nepal's tea country with rolling green hills and cool viewpoints.",
     "best_time": ["Mar", "Apr", "Oct", "Nov"], "popular_attractions": ["Kanyam Tea Garden", "Shree Antu"]},
]


def _registry_matches(query: str) -> List[Dict[str, Any]]:
    q = query.strip().lower()
    if not q:
        return _REGISTRY[:6]
    return [d for d in _REGISTRY if q in d["name"].lower() or q in d["country"].lower()][:6]


async def _search_nominatim(query: str) -> List[Dict[str, Any]]:
    headers = {"User-Agent": settings.osm_user_agent, "Accept-Language": "en"}
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 6,
        "countrycodes": "np",
    }
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        resp = await client.get(f"{settings.nominatim_url}/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    results: List[Dict[str, Any]] = []
    for row in data[:6]:
        address = row.get("address") or {}
        name = (
            row.get("name")
            or address.get("city")
            or address.get("town")
            or address.get("village")
            or str(row.get("display_name", query)).split(",")[0]
        )
        try:
            lat = float(row["lat"])
            lon = float(row["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        results.append({
            "id": f"osm:{row.get('osm_type', 'place')}:{row.get('osm_id', '')}",
            "name": name,
            "country": address.get("country", "Nepal"),
            "lat": lat,
            "lon": lon,
            "description": row.get("display_name", ""),
        })
    return results


async def search(query: str) -> List[Dict[str, Any]]:
    query = query.strip()
    registry = _registry_matches(query)
    if not query:
        return registry

    # Known destinations should be instant and work offline.
    exact = [d for d in registry if d["name"].lower() == query.lower()]
    if exact:
        return exact + [d for d in registry if d not in exact]

    try:
        osm_results = await _search_nominatim(query)
        if osm_results:
            seen = {(r["name"].lower(), round(r["lat"], 4), round(r["lon"], 4)) for r in osm_results}
            for item in registry:
                key = (item["name"].lower(), round(item["lat"], 4), round(item["lon"], 4))
                if key not in seen and len(osm_results) < 6:
                    osm_results.append(item)
            return osm_results[:6]
    except Exception:
        pass

    return registry


def get_by_id(dest_id: str) -> Optional[Dict[str, Any]]:
    return next((d for d in _REGISTRY if d["id"] == dest_id), None)
