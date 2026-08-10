from typing import Dict, Any, List, Optional, Tuple
import asyncio
import math
import time

import httpx

from config import settings


CATEGORY_ICONS = {
    "Attractions": "🏛️", "Restaurants": "🍴", "Cafés": "☕", "Hotels": "🏨",
    "Banks": "🏦", "ATMs": "🏧", "Currency Exchange": "💱", "Hospitals": "🏥",
    "Transportation": "🚌",
}

# More inclusive selectors improve coverage in rural / trekking destinations.
CATEGORY_SELECTORS = {
    "Attractions": [
        '["tourism"~"attraction|museum|viewpoint|gallery|artwork|information"]["name"]',
        '["historic"]["name"]',
        '["natural"~"peak|waterfall|cave_entrance|spring"]["name"]',
        '["amenity"="place_of_worship"]["name"]',
    ],
    "Restaurants": [
        '["amenity"="restaurant"]["name"]',
        '["amenity"="fast_food"]["name"]',
        '["amenity"="food_court"]["name"]',
    ],
    "Cafés": [
        '["amenity"="cafe"]["name"]',
        '["shop"="coffee"]["name"]',
    ],
    "Hotels": [
        '["tourism"~"hotel|guest_house|hostel|motel|alpine_hut|camp_site"]["name"]',
    ],
    "Banks": ['["amenity"="bank"]["name"]'],
    "ATMs": ['["amenity"="atm"]["name"]'],
    "Currency Exchange": ['["amenity"="bureau_de_change"]["name"]'],
    "Hospitals": [
        '["amenity"~"hospital|clinic|doctors"]["name"]',
        '["healthcare"~"hospital|clinic|doctor"]["name"]',
    ],
    "Transportation": [
        '["amenity"~"bus_station|taxi"]["name"]',
        '["railway"="station"]["name"]',
        '["public_transport"~"station|platform"]["name"]',
        '["aeroway"~"aerodrome|terminal"]["name"]',
    ],
}

# Small fallback list for local demo continuity only. We never show fallback
# entries farther than 35 km from the selected coordinates.
_DEMO_PLACES = [
    {"id": "p1", "name": "Phewa Lake", "category": "Attractions", "lat": 28.2096, "lon": 83.9896, "addr": "Pokhara, Nepal", "rating": "4.8"},
    {"id": "p3", "name": "Lakeside Café", "category": "Cafés", "lat": 28.2075, "lon": 83.9800, "addr": "Lakeside Road, Pokhara", "rating": "4.5"},
    {"id": "p2", "name": "Mom's Kitchen", "category": "Restaurants", "lat": 28.2060, "lon": 83.9820, "addr": "Lakeside, Pokhara", "rating": "4.6"},
    {"id": "p4", "name": "Hotel Lake View", "category": "Hotels", "lat": 28.2110, "lon": 83.9880, "addr": "Lakeside, Pokhara", "rating": "4.4"},
    {"id": "p5", "name": "Nabil Bank", "category": "Banks", "lat": 28.2040, "lon": 83.9780, "addr": "Lakeside, Pokhara"},
    {"id": "p6", "name": "ATM (Machhapuchhre)", "category": "ATMs", "lat": 28.2055, "lon": 83.9850, "addr": "Lakeside, Pokhara"},
    {"id": "p7", "name": "Currency Exchange", "category": "Currency Exchange", "lat": 28.2080, "lon": 83.9840, "addr": "Lakeside, Pokhara"},
    {"id": "p8", "name": "City Hospital", "category": "Hospitals", "lat": 28.2010, "lon": 83.9760, "addr": "Pokhara"},
    {"id": "p10", "name": "Fewa Lake Cable Car", "category": "Transportation", "lat": 28.2100, "lon": 83.9900, "addr": "Pokhara"},
    {"id": "p9", "name": "Sarangkot Viewpoint", "category": "Attractions", "lat": 28.2560, "lon": 83.9500, "addr": "Pokhara", "rating": "4.9"},
    {"id": "k1", "name": "Swayambhunath", "category": "Attractions", "lat": 27.7150, "lon": 85.2900, "addr": "Kathmandu", "rating": "4.7"},
    {"id": "k2", "name": "Thamel Restaurant", "category": "Restaurants", "lat": 27.7160, "lon": 85.3120, "addr": "Thamel, Kathmandu", "rating": "4.4"},
    {"id": "k3", "name": "Thamel Café", "category": "Cafés", "lat": 27.7155, "lon": 85.3130, "addr": "Thamel, Kathmandu"},
    {"id": "k4", "name": "Hotel Everest", "category": "Hotels", "lat": 27.7168, "lon": 85.3140, "addr": "Thamel, Kathmandu", "rating": "4.3"},
    {"id": "k5", "name": "Boudhanath Stupa", "category": "Attractions", "lat": 27.7215, "lon": 85.3620, "addr": "Kathmandu", "rating": "4.8"},
    {"id": "k6", "name": "Patan Durbar Square", "category": "Attractions", "lat": 27.6720, "lon": 85.3260, "addr": "Lalitpur, Kathmandu", "rating": "4.7"},
    {"id": "c1", "name": "Chitwan National Park", "category": "Attractions", "lat": 27.5291, "lon": 84.3544, "addr": "Chitwan", "rating": "4.8"},
    {"id": "l1", "name": "Maya Devi Temple", "category": "Attractions", "lat": 27.4696, "lon": 83.2756, "addr": "Lumbini", "rating": "4.7"},
    {"id": "l2", "name": "World Peace Pagoda", "category": "Attractions", "lat": 27.4830, "lon": 83.2870, "addr": "Lumbini", "rating": "4.6"},
    {"id": "m2", "name": "Muktinath Temple", "category": "Attractions", "lat": 28.8170, "lon": 83.8713, "addr": "Mustang", "rating": "4.8"},
    {"id": "i1", "name": "Kanyam Tea Garden", "category": "Attractions", "lat": 26.9100, "lon": 87.9260, "addr": "Ilam", "rating": "4.7"},
]

_CACHE: Dict[Tuple[float, float, str], Tuple[float, int, List[Dict[str, Any]]]] = {}
CACHE_SECONDS = 300
FALLBACK_CACHE_SECONDS = 20


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _demo_places(lat: float, lon: float, category: Optional[str]) -> List[Dict[str, Any]]:
    rows = []
    for source in _DEMO_PLACES:
        if category and source["category"].lower() != category.lower():
            continue
        distance_km = _haversine(lat, lon, source["lat"], source["lon"])
        if distance_km > 35:
            continue
        row = dict(source)
        row["icon"] = CATEGORY_ICONS.get(row["category"], "📍")
        row["distance"] = f"{distance_km:.2f} km"
        row["url"] = f"https://www.openstreetmap.org/?mlat={row['lat']}&mlon={row['lon']}#map=17/{row['lat']}/{row['lon']}"
        rows.append(row)
    rows.sort(key=lambda r: float(r["distance"].split()[0]))
    return rows[:30]


def _build_query(lat: float, lon: float, category: Optional[str], radius: int) -> str:
    categories = [category] if category in CATEGORY_SELECTORS else list(CATEGORY_SELECTORS)
    statements = []
    for cat in categories:
        for selector in CATEGORY_SELECTORS[cat]:
            statements.append(f"nwr(around:{radius},{lat},{lon}){selector};")
    # Limit the response size because the UI only needs nearby cards/markers.
    return "[out:json][timeout:16];(" + "".join(statements) + ");out tags center qt 120;"


def _infer_category(tags: Dict[str, Any]) -> str:
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    natural = tags.get("natural", "")
    historic = tags.get("historic", "")
    healthcare = tags.get("healthcare", "")
    railway = tags.get("railway", "")
    public_transport = tags.get("public_transport", "")
    aeroway = tags.get("aeroway", "")
    if amenity in {"restaurant", "fast_food", "food_court"}: return "Restaurants"
    if amenity == "cafe" or tags.get("shop") == "coffee": return "Cafés"
    if tourism in {"hotel", "guest_house", "hostel", "motel", "alpine_hut", "camp_site"}: return "Hotels"
    if amenity == "bank": return "Banks"
    if amenity == "atm": return "ATMs"
    if amenity == "bureau_de_change": return "Currency Exchange"
    if amenity in {"hospital", "clinic", "doctors"} or healthcare in {"hospital", "clinic", "doctor"}: return "Hospitals"
    if amenity in {"bus_station", "taxi"} or railway == "station" or public_transport in {"station", "platform"} or aeroway in {"aerodrome", "terminal"}: return "Transportation"
    if tourism or natural or historic or amenity == "place_of_worship": return "Attractions"
    return "Attractions"


def _address(tags: Dict[str, Any]) -> str:
    full = tags.get("addr:full")
    if full:
        return full
    street = " ".join(x for x in [tags.get("addr:housenumber", ""), tags.get("addr:street", "")] if x).strip()
    locality = (
        tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village")
        or tags.get("addr:suburb") or tags.get("addr:district") or ""
    )
    parts = [p for p in [street, locality] if p]
    return ", ".join(parts)


def _parse_places(payload: Dict[str, Any], lat: float, lon: float, requested_category: Optional[str]) -> List[Dict[str, Any]]:
    places: List[Dict[str, Any]] = []
    seen = set()
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        name = tags.get("name:en") or tags.get("name") or tags.get("brand")
        if not name:
            continue
        plat = element.get("lat") or (element.get("center") or {}).get("lat")
        plon = element.get("lon") or (element.get("center") or {}).get("lon")
        if plat is None or plon is None:
            continue
        plat, plon = float(plat), float(plon)
        cat = _infer_category(tags)
        if requested_category and cat != requested_category:
            continue
        key = (name.casefold(), round(plat, 5), round(plon, 5))
        if key in seen:
            continue
        seen.add(key)
        osm_type = element.get("type", "node")
        osm_id = element.get("id", "")
        distance = _haversine(lat, lon, plat, plon)
        places.append({
            "id": f"osm-{osm_type}-{osm_id}",
            "name": name,
            "category": cat,
            "icon": CATEGORY_ICONS.get(cat, "📍"),
            "lat": plat,
            "lon": plon,
            "addr": _address(tags),
            "distance": f"{distance:.2f} km",
            "description": tags.get("description") or tags.get("tourism") or tags.get("amenity") or tags.get("natural"),
            "url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        })
    places.sort(key=lambda p: float(p["distance"].split()[0]))
    return places[:50]


async def _query_endpoint(endpoint: str, query: str, lat: float, lon: float, category: Optional[str]) -> List[Dict[str, Any]]:
    headers = {
        "User-Agent": settings.osm_user_agent,
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=8, headers=headers, follow_redirects=True) as client:
        response = await client.post(endpoint, data={"data": query})
        response.raise_for_status()
        return _parse_places(response.json(), lat, lon, category)


async def _overpass_places(lat: float, lon: float, category: Optional[str]) -> List[Dict[str, Any]]:
    # Sparse categories such as ATMs/hotels in mountain areas need a wider net.
    radii = [8000, 18000, 35000] if category else [9000, 18000]
    endpoints = settings.overpass_urls
    last_error: Optional[Exception] = None

    for radius in radii:
        query = _build_query(lat, lon, category, radius)
        # Try two endpoints concurrently; the first useful result wins.
        tasks = [asyncio.create_task(_query_endpoint(ep, query, lat, lon, category)) for ep in endpoints[:2]]
        primary_succeeded = False
        try:
            for task in asyncio.as_completed(tasks):
                try:
                    result = await task
                    primary_succeeded = True
                    # A successful empty result means this radius truly has no matching
                    # mapped POIs; cancel duplicate server work and expand the radius.
                    for other in tasks:
                        if not other.done():
                            other.cancel()
                    if result:
                        return result
                    break
                except Exception as exc:
                    last_error = exc
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()

        # Only use extra instances when both primary servers failed.
        if not primary_succeeded:
            for endpoint in endpoints[2:]:
                try:
                    result = await _query_endpoint(endpoint, query, lat, lon, category)
                    primary_succeeded = True
                    if result:
                        return result
                    break
                except Exception as exc:
                    last_error = exc

    if last_error:
        raise last_error
    return []


async def get_places(lat: float, lon: float, category: Optional[str] = None) -> List[Dict[str, Any]]:
    key = (round(lat, 3), round(lon, 3), category or "ALL")
    cached = _CACHE.get(key)
    if cached and time.monotonic() - cached[0] < cached[1]:
        return cached[2]

    try:
        # Keep the UI responsive even if a public Overpass instance is overloaded.
        results = await asyncio.wait_for(_overpass_places(lat, lon, category), timeout=10)
        if results:
            _CACHE[key] = (time.monotonic(), CACHE_SECONDS, results)
            return results
    except Exception:
        if not settings.use_mock:
            raise

    if settings.use_mock:
        fallback = _demo_places(lat, lon, category)
        _CACHE[key] = (time.monotonic(), FALLBACK_CACHE_SECONDS, fallback)
        return fallback
    return []
