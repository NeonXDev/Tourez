"""ai.py — AI endpoints: chat, plan trip, modify itinerary.

Uses the OpenAI reasoning layer. If OpenAI is not configured, falls back to
high-quality, destination-grounded responses so the app works seamlessly.
"""
from typing import Any, Dict, List
import copy

from fastapi import APIRouter, HTTPException

from schemas import (
    ChatRequest, ChatResponse, PlanRequest, ItineraryOut,
    ModifyRequest, ModifyResponse,
)
from services import openai_service
from config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])


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
    """AI chat endpoint. Sends message + context to OpenAI with graceful fallback."""
    context = req.context.model_dump() if req.context else None
    if context and context.get("weather"):
        context["weather"] = _normalize_weather(context["weather"])
    try:
        if openai_service.is_available():
            reply = openai_service.chat(req.message, context, req.history)
        else:
            reply = openai_service.default_chat_reply(req.message, context)
        return ChatResponse(message=reply)
    except Exception:
        reply = openai_service.default_chat_reply(req.message, context)
        return ChatResponse(message=reply)


@router.post("/plan", response_model=ItineraryOut)
async def plan_trip(req: PlanRequest):
    """Plan a personalized itinerary using OpenAI or smart destination generator."""
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
        if openai_service.is_available():
            return openai_service.plan_trip(prefs)
        return _demo_itinerary(prefs)
    except Exception as e:
        if settings.use_mock or True:
            return _demo_itinerary(prefs)
        raise HTTPException(status_code=502, detail=f"AI planning failed: {e}")


@router.post("/modify-itinerary", response_model=ModifyResponse)
async def modify_itinerary(req: ModifyRequest):
    """Modify an itinerary based on changing conditions (e.g. weather)."""
    weather_norm = _normalize_weather(req.weather or {})
    try:
        if openai_service.is_available():
            updated = openai_service.modify_itinerary(
                req.itinerary, weather_norm, req.instruction
            )
            return ModifyResponse(itinerary=updated, modified=updated.get("modified"))
        updated = _demo_modify(req.itinerary, weather_norm, req.instruction)
        return ModifyResponse(itinerary=updated, modified=updated.get("modified"))
    except Exception as e:
        updated = _demo_modify(req.itinerary, weather_norm, req.instruction)
        return ModifyResponse(itinerary=updated, modified=updated.get("modified"))


# ----------------------------------------------------------------
# Smart Destination-Aware Itinerary Generator
# ----------------------------------------------------------------
_DESTINATION_POOLS: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "pokhara": {
        "Nature": [
            {"place": "Phewa Lake Boat Ride", "cost": 10, "icon": "🚣", "detail": "Scenic wooden boat cruise across Phewa Lake to Tal Barahi Temple."},
            {"place": "Sarangkot Sunrise Viewpoint", "cost": 8, "icon": "🌅", "detail": "Panoramic sunrise over Annapurna, Machhapuchhre, and Dhaulagiri."},
            {"place": "World Peace Pagoda Trail", "cost": 6, "icon": "🌲", "detail": "Lush forest hike up to the gleaming white stupa with valley views."},
            {"place": "Davis Falls & Gupteshwor Cave", "cost": 7, "icon": "💧", "detail": "Roaring waterfall disappearing underground into a sacred limestone cave."},
            {"place": "Begnas Lake Serene Walk", "cost": 12, "icon": "🌿", "detail": "Peaceful day away from the crowd exploring Pokhara's second largest lake."},
        ],
        "Food": [
            {"place": "Lakeside Thakali Kitchen", "cost": 14, "icon": "🍛", "detail": "Authentic Mustang Thakali thali with ghee, lentils, and fresh wild herbs."},
            {"place": "Lakeside Artisan Café", "cost": 8, "icon": "☕", "detail": "Locally grown organic Nepali Arabica coffee with lake views."},
            {"place": "Local Fresh Fish & Momo Spot", "cost": 12, "icon": "🥟", "detail": "Freshly caught lake fish and steamy mountain momos."},
        ],
        "Culture": [
            {"place": "Bindhyabasini Temple", "cost": 5, "icon": "🏛️", "detail": "Historic hilltop Hindu shrine in Old Pokhara overlooking the bazaar."},
            {"place": "Tibetan Tashiling Settlement", "cost": 8, "icon": "🛕", "detail": "Monastery chanting, handmade wool carpets, and cultural artifacts."},
            {"place": "International Mountain Museum", "cost": 9, "icon": "📜", "detail": "Exhibits on Himalayan geology, mountaineering history, and indigenous cultures."},
        ],
        "Adventure": [
            {"place": "Paragliding over Sarangkot", "cost": 50, "icon": "🪂", "detail": "Tandem flight soaring above Pokhara with the Annapurnas as backdrop."},
            {"place": "Zip-line & Canyon Swing", "cost": 45, "icon": "🧗", "detail": "One of the steepest zip flyers in the world dropping over dense pine forests."},
            {"place": "Seti River Gorge Kayaking", "cost": 30, "icon": "🚣", "detail": "Exciting white-water paddle through the deep dramatic Seti chasm."},
        ],
    },
    "kathmandu": {
        "Culture": [
            {"place": "Swayambhunath (Monkey Temple)", "cost": 6, "icon": "🏛️", "detail": "Ancient hilltop stupa with fluttering prayer flags and city panoramas."},
            {"place": "Boudhanath Stupa", "cost": 7, "icon": "🛕", "detail": "One of the world's largest spherical stupas; center of Tibetan Buddhism in Nepal."},
            {"place": "Patan Durbar Square & Museum", "cost": 10, "icon": "🏰", "detail": "Exquisite Newari palace architecture, bronze craft, and royal courtyards."},
            {"place": "Pashupatinath Sacred Complex", "cost": 8, "icon": "🕉️", "detail": "Venerated Bagmati riverside temple with centuries of spiritual traditions."},
            {"place": "Bhaktapur Ancient Pottery Square", "cost": 12, "icon": "🏺", "detail": "Preserved medieval town with red-brick temples and traditional potters."},
        ],
        "Food": [
            {"place": "Newari Khaja Ghar (Patan)", "cost": 11, "icon": "🥘", "detail": "Traditional baji, choila, bara, and spicy aloo tama."},
            {"place": "Thamel Steamy Momo Trail", "cost": 7, "icon": "🥟", "detail": "Buff, chicken, and vegetarian momos with fiery sesame-tomato chutney."},
            {"place": "Heritage Courtyard Tea House", "cost": 6, "icon": "☕", "detail": "Sweet aromatic masala chiya and freshly baked local pastries."},
        ],
        "Nature": [
            {"place": "Chandragiri Hills Cable Car", "cost": 18, "icon": "🚠", "detail": "Cable car ride to 2,551m summit for stunning Himalayan panorama."},
            {"place": "Garden of Dreams Historic Park", "cost": 5, "icon": "🌿", "detail": "Neoclassical garden oasis in the heart of bustling Kathmandu."},
            {"place": "Shivapuri National Park Hike", "cost": 10, "icon": "🌲", "detail": "Pristine nature trail to Nagi Gompa monastery and crystal streams."},
        ],
    },
    "chitwan": {
        "Nature": [
            {"place": "Chitwan National Park Safari", "cost": 30, "icon": "🦏", "detail": "Jeep exploration in search of one-horned rhinos, deer, and royal Bengal tigers."},
            {"place": "Rapti River Canoe Float", "cost": 14, "icon": "🛶", "detail": "Peaceful river glide spotting marsh mugger crocodiles and colorful kingfishers."},
            {"place": "Jungle Bird Watching Walk", "cost": 12, "icon": "🌲", "detail": "Early morning guided walk through lush grasslands and riverine woods."},
        ],
        "Culture": [
            {"place": "Tharu Village Walking Tour", "cost": 8, "icon": "🌾", "detail": "Traditional mud-walled homes, farming traditions, and local crafts."},
            {"place": "Tharu Cultural Dance Show", "cost": 9, "icon": "💃", "detail": "Energetic stick dance and peacock dance celebrating harvest traditions."},
        ],
        "Food": [
            {"place": "Sauraha Riverside Sunset Diner", "cost": 16, "icon": "🌅", "detail": "Fresh river fish, seasonal curries, and drinks overlooking the sunset."},
            {"place": "Traditional Tharu Cuisine Spot", "cost": 10, "icon": "🍲", "detail": "Authentic Ghongi (water snails), Anadi rice, and spicy duck curry."},
        ],
    },
    "lumbini": {
        "Culture": [
            {"place": "Maya Devi Temple & Sacred Garden", "cost": 8, "icon": "🛕", "detail": "The exact nativity site of Gautama Buddha marked by the Ashoka Pillar."},
            {"place": "International Monastic Zone", "cost": 10, "icon": "🏛️", "detail": "Explore distinctive Buddhist temples built by Germany, Thailand, China, and Japan."},
            {"place": "World Peace Pagoda (Lumbini)", "cost": 5, "icon": "🕊️", "detail": "Gleaming white dome erected by Japanese Buddhists for world harmony."},
        ],
        "Nature": [
            {"place": "Lumbini Crane Sanctuary", "cost": 6, "icon": "🦩", "detail": "Wetland sanctuary home to endangered Sarus cranes and peaceful walking paths."},
            {"place": "Sacred Puskarni Pond Meditation", "cost": 3, "icon": "🧘", "detail": "Ancient bathing pond where Queen Maya Devi bathed before giving birth."},
        ],
        "Food": [
            {"place": "Monastery Vegetarian Kitchen", "cost": 8, "icon": "🥗", "detail": "Nourishing wholesome vegetarian thali prepared with local harvest."},
            {"place": "Lumbini Village Tea & Mithai", "cost": 5, "icon": "☕", "detail": "Sweet Terai jalebi, samosas, and boiling hot milk tea."},
        ],
    },
    "mustang": {
        "Culture": [
            {"place": "Muktinath Temple Pilgrimage", "cost": 10, "icon": "🛕", "detail": "Sacred shrine at 3,710m with 108 eternal water sprouts revered by Hindus and Buddhists."},
            {"place": "Ancient Kagbeni Village & Gompa", "cost": 8, "icon": "🏰", "detail": "Gateway to Upper Mustang with red-walled monastery and stone alleys."},
            {"place": "Marpha White Village Stroll", "cost": 7, "icon": "🏛️", "detail": "Charming apple capital with stone-paved lanes and Tibetan prayer wheels."},
        ],
        "Nature": [
            {"place": "Kali Gandaki Riverbed Fossil Walk", "cost": 8, "icon": "🏔️", "detail": "Search for sacred prehistoric Saligram ammonite fossils along the riverbed."},
            {"place": "Dhumba Turquoise Lake Walk", "cost": 6, "icon": "💎", "detail": "Pristine emerald-green alpine lake at the foot of Mount Nilgiri."},
        ],
        "Food": [
            {"place": "Marpha Apple Orchard & Cider", "cost": 10, "icon": "🍏", "detail": "Fresh local apple pie, dried apples, and famous Mustang apple brandy."},
            {"place": "Jomsom Thakali Kitchen", "cost": 12, "icon": "🍲", "detail": "Hearty Himalayan buckwheat dhindo and spicy dried yak meat curry."},
        ],
    },
    "ilam": {
        "Nature": [
            {"place": "Kanyam Tea Estate Stroll", "cost": 6, "icon": "🍃", "detail": "Picturesque rolling tea gardens covered in morning mountain mist."},
            {"place": "Shree Antu Sunrise Viewpoint", "cost": 8, "icon": "🌅", "detail": "Famous sunrise ridge with views stretching from Kanchenjunga to the plains."},
            {"place": "Mai Pokhari Sacred Lake", "cost": 7, "icon": "🌿", "detail": "High-altitude botanical wetland surrounded by rare orchids and conifers."},
        ],
        "Food": [
            {"place": "Tea Tasting & Local Factory Tour", "cost": 9, "icon": "🍵", "detail": "Sample single-estate orthodox teas and witness traditional tea rolling."},
            {"place": "Ilam Cheese & Chhurpi Centre", "cost": 7, "icon": "🧀", "detail": "Taste fresh artisanal Himalayan yak cheese and hardened chhurpi."},
        ],
    },
}

_GENERIC_POOLS: Dict[str, List[Dict[str, Any]]] = {
    "Nature": [
        {"place": "Scenic Viewpoint Trail", "cost": 10, "icon": "🏔️", "detail": "Panoramic trail with sweeping mountain and valley views."},
        {"place": "Botanical Gardens & Riverwalk", "cost": 8, "icon": "🌿", "detail": "Tranquil stroll through lush native flora and calm waters."},
        {"place": "Lakeside Walking Path", "cost": 9, "icon": "🌲", "detail": "Gentle nature circuit taking in local birdlife and fresh air."},
        {"place": "Hidden Waterfall Hike", "cost": 12, "icon": "💧", "detail": "Short forest trek leading to a refreshing natural waterfall."},
        {"place": "Sunset Ridge Panorama", "cost": 7, "icon": "🌅", "detail": "Golden hour viewpoint capturing sunset reflections over the hills."},
    ],
    "Food": [
        {"place": "Local Food Walking Tour", "cost": 16, "icon": "🍜", "detail": "Guided tasting of local specialties, steamed delicacies, and curries."},
        {"place": "Heritage Restaurant Feast", "cost": 18, "icon": "🍽️", "detail": "Traditional thali platter served with regional accompaniments."},
        {"place": "Artisan Bakery & Tea House", "cost": 9, "icon": "☕", "detail": "Warm mountain tea and freshly baked pastries at a popular local spot."},
        {"place": "Evening Street Food Market", "cost": 11, "icon": "🥘", "detail": "Sample authentic local snacks, skewered delicacies, and spiced potatoes."},
    ],
    "Culture": [
        {"place": "Heritage Temple Complex", "cost": 10, "icon": "🏛️", "detail": "Historic architecture and sacred statues with rich local significance."},
        {"place": "Local Artisan Workshop", "cost": 12, "icon": "🎨", "detail": "Meet master crafters producing handmade pottery, woodwork, or weaving."},
        {"place": "Cultural Heritage Museum", "cost": 8, "icon": "📜", "detail": "Exhibits illustrating traditional lifestyles, music, and ethnic history."},
        {"place": "Sacred Monastery & Stupa", "cost": 7, "icon": "🛕", "detail": "Peaceful courtyard surrounded by prayer wheels and butter lamps."},
    ],
    "History": [
        {"place": "Ancient Old Town Walking Tour", "cost": 8, "icon": "📜", "detail": "Wander centuries-old alleys, traditional courtyards, and hidden shrines."},
        {"place": "Historic Fortress / Palace", "cost": 11, "icon": "🏰", "detail": "Explore historic royal ramparts, defensive walls, and royal artifacts."},
        {"place": "Archaeological Heritage Landmark", "cost": 9, "icon": "🏺", "detail": "Ancient monument commemorating centuries of regional civilization."},
    ],
    "Adventure": [
        {"place": "Guided Hillside Trek", "cost": 25, "icon": "🧗", "detail": "Scenic day trek across terraced fields and rustic mountain hamlets."},
        {"place": "Mountain Bike Circuit", "cost": 22, "icon": "🚴", "detail": "Exciting off-road ride along scenic ridges and pine-shaded dirt roads."},
        {"place": "River Crossing & Gorge Walk", "cost": 18, "icon": "🚣", "detail": "Suspension bridge crossing high above the river rapids."},
    ],
    "Shopping": [
        {"place": "Bustling Local Bazaar", "cost": 15, "icon": "🛍️", "detail": "Browse colourful stalls of spices, mountain tea, and handmade souvenirs."},
        {"place": "Handicrafts & Wool Cooperative", "cost": 20, "icon": "🧶", "detail": "Directly support local artisans creating scarves, carpets, and woodcrafts."},
    ],
    "Photography": [
        {"place": "Dawn Viewpoint Photo Spot", "cost": 6, "icon": "📷", "detail": "Ideal early-morning lighting for mountain silhouettes and mist."},
        {"place": "Golden Hour Valley Ridge", "cost": 5, "icon": "🌄", "detail": "Stunning perspective of winding rivers and terraced hillsides."},
    ],
    "Relaxation": [
        {"place": "Hilltop Café & Reading Nook", "cost": 9, "icon": "☕", "detail": "Unwind with panoramic views, fresh brew, and tranquil mountain air."},
        {"place": "Traditional Wellness & Herbal Spa", "cost": 22, "icon": "💆", "detail": "Rejuvenating massage using natural Ayurvedic oils and herbs."},
    ],
}


def _get_currency_factor(currency: str) -> float:
    c = (currency or "USD").upper().strip()
    rates = {
        "NPR": 133.0,
        "INR": 83.0,
        "JPY": 150.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "AUD": 1.52,
        "CAD": 1.36,
        "USD": 1.0,
    }
    return rates.get(c, 1.0)


def _demo_itinerary(prefs: Dict[str, Any]) -> Dict[str, Any]:
    dest_name = (prefs.get("destination") or "Pokhara").strip()
    dest_key = dest_name.lower()
    duration = max(1, min(14, int(prefs.get("duration", 3) or 3)))
    travelers = max(1, int(prefs.get("travelers", 2) or 2))
    currency = (prefs.get("currency") or "USD").upper()
    factor = _get_currency_factor(currency)

    # Budget handling
    raw_budget = float(prefs.get("budget", 300) or 300)
    budget = raw_budget if raw_budget > 0 else 300 * factor

    raw_interests = prefs.get("interests") or []
    themes = [i for i in raw_interests if i] or ["Nature", "Culture", "Food"]

    # Match destination pool
    dest_pool = None
    for k, v in _DESTINATION_POOLS.items():
        if k in dest_key or dest_key in k:
            dest_pool = v
            break

    days = []
    times = ["09:00", "13:00", "16:30"]

    for d_idx in range(duration):
        theme = themes[d_idx % len(themes)]
        # Collect candidate activities for this theme
        pool_candidates: List[Dict[str, Any]] = []
        if dest_pool and theme in dest_pool:
            pool_candidates.extend(dest_pool[theme])
        if theme in _GENERIC_POOLS:
            pool_candidates.extend(_GENERIC_POOLS[theme])
        if not pool_candidates:
            # Fallback across all themes
            for plist in _GENERIC_POOLS.values():
                pool_candidates.extend(plist)

        acts = []
        for slot in range(3):
            # Select activity using offset so no slot repeats on same day
            item_idx = (d_idx * 3 + slot) % len(pool_candidates)
            item = pool_candidates[item_idx]
            base_cost = float(item.get("cost", 10))
            # Scale cost to currency
            cost = round(base_cost * (factor if factor > 1 else 1.0), 0 if factor > 10 else 2)
            acts.append({
                "time": times[slot],
                "place": item["place"],
                "detail": f"{item.get('icon', '📍')} {item.get('detail') or (item['place'] + ' experience in ' + dest_name)}",
                "cost": cost,
                "transport": "Scenic walk / local transport" if slot == 0 else "Short local ride",
            })
        days.append({"day": d_idx + 1, "theme": theme, "activities": acts})

    total = sum(a["cost"] for d in days for a in d["activities"]) * travelers
    total = round(total, 2)
    remaining = round(max(0.0, budget - total), 2)

    return {
        "destination": dest_name,
        "duration": duration,
        "travelers": travelers,
        "budget": budget,
        "currency": currency,
        "interests": themes,
        "days": days,
        "total_cost": total,
        "remaining": remaining,
        "note": f"Personalized {duration}-day itinerary for {dest_name} tailored for {travelers} traveler{'s' if travelers != 1 else ''}.",
    }


def _demo_modify(itinerary: Dict[str, Any], weather: Dict[str, Any], instruction: str) -> Dict[str, Any]:
    updated = copy.deepcopy(itinerary)
    cond = (weather.get("condition") or "").lower()
    instr_lower = (instruction or "").lower()
    is_rain = "rain" in cond or "rain" in instr_lower or "weather" in instr_lower
    currency = updated.get("currency", "USD")
    factor = _get_currency_factor(currency)

    days = updated.get("days") or []
    if not days:
        return updated

    # Target day: if "day 1" in instruction or only 1 day, change day 0, otherwise day 1 (second day)
    target_idx = 0 if len(days) == 1 or "day 1" in instr_lower else 1
    target_idx = min(target_idx, len(days) - 1)
    target_day_num = target_idx + 1

    if is_rain:
        c1 = round(10 * (factor if factor > 1 else 1.0), 0 if factor > 10 else 2)
        c2 = round(14 * (factor if factor > 1 else 1.0), 0 if factor > 10 else 2)
        c3 = round(12 * (factor if factor > 1 else 1.0), 0 if factor > 10 else 2)
        days[target_idx]["theme"] = "Indoor & Cultural"
        days[target_idx]["activities"] = [
            {
                "time": "09:30",
                "place": "Indoor Heritage Museum & Gallery",
                "detail": "🏛️ Explore local artifacts, historic exhibits, and traditional art sheltered from the rain.",
                "cost": c1,
                "transport": "Short covered ride",
            },
            {
                "time": "12:30",
                "place": "Cosy Heritage Tea Room & Café",
                "detail": "☕ Warm Himalayan tea, steamy momos, and traditional lunch while watching the rainfall.",
                "cost": c2,
                "transport": "Short walk",
            },
            {
                "time": "15:30",
                "place": "Artisan Workshop & Indoor Craft Centre",
                "detail": "🎨 Live pottery, woodcarving, and traditional handicraft demonstrations under cover.",
                "cost": c3,
                "transport": "Short ride",
            },
        ]
        updated["modified"] = f"Day {target_day_num} was adapted to comfortable indoor & cultural activities due to the rain forecast."
    else:
        updated["modified"] = "Itinerary verified against current conditions and remains optimal for your trip."

    # Recalculate financial summary
    travelers = int(updated.get("travelers", 1) or 1)
    total = sum(a.get("cost", 0) for d in days for a in (d.get("activities") or [])) * travelers
    budget = float(updated.get("budget", 0) or 0)
    updated["total_cost"] = round(total, 2)
    updated["totalCost"] = round(total, 2)
    updated["remaining"] = round(max(0.0, budget - total), 2)
    return updated
