const USE_MOCK = false;

const API_BASE = window.TOUREZ_API_BASE || "http://localhost:8000";

/** Small helper to make a JSON fetch with a timeout. */
async function apiFetch(path, options = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), options.timeout || 15000);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            signal: controller.signal,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

function mockDelay(ms = 900) {
    return new Promise((r) => setTimeout(r, ms + Math.random() * 500));
}

function normalizeItinerary(data) {
    if (!data) return data;
    return {
        ...data,
        totalCost: data.totalCost ?? data.total_cost ?? 0,
        remaining: data.remaining ?? 0,
    };
}

async function searchDestinations(query) {
    if (USE_MOCK) {
        await mockDelay(500);
        const q = query.toLowerCase().trim();
        const all = window.SmartTour && window.SmartTour.DESTINATIONS ? window.SmartTour.DESTINATIONS : [];
        return all.filter((d) =>
            d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)
        ).slice(0, 6);
    }
    // LIVE MODE:
    return apiFetch(`/api/destination?q=${encodeURIComponent(query)}`);
}

async function getDestination(id) {
    if (USE_MOCK) {
        await mockDelay(600);
        const all = window.SmartTour && window.SmartTour.DESTINATIONS ? window.SmartTour.DESTINATIONS : [];
        return all.find((d) => d.id === id) || null;
    }
    return apiFetch(`/api/destination/${id}`);
}

/* ============================================================
   WEATHER SERVICE  →  /api/weather
   ============================================================ */
async function getWeather(destination) {
    if (USE_MOCK) {
        await mockDelay(1000);
        // Deterministic pseudo data keyed by destination name (demo only).
        const seed = (destination.name || "Pokhara").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"];
        const icons = ["☀️", "🌤️", "☁️", "🌦️", "🌙"];
        const idx = seed % 5;
        return {
            location: `${destination.name}, ${destination.country}`,
            temp: 18 + (seed % 12),
            feelsLike: 17 + (seed % 12),
            condition: conditions[idx],
            icon: icons[idx],
            humidity: 40 + (seed % 50),
            wind: 5 + (seed % 20),
            forecast: [
                { day: "Today", icon: icons[(idx + 1) % 5], high: 20 + (seed % 10), low: 14 + (seed % 6) },
                { day: "Tomorrow", icon: icons[(idx + 2) % 5], high: 19 + (seed % 10), low: 13 + (seed % 6) },
                { day: "Tuesday", icon: icons[(idx + 3) % 5], high: 21 + (seed % 10), low: 15 + (seed % 6) },
            ],
            updatedAt: new Date().toISOString(),
        };
    }
    return apiFetch(`/api/weather?lat=${destination.lat}&lon=${destination.lon}&location=${encodeURIComponent(`${destination.name || "Current location"}${destination.country ? ", " + destination.country : ""}`)}`);
}

/* ============================================================
   PLACES SERVICE  →  /api/places
   ============================================================ */
async function getNearbyPlaces(destination, category) {
    if (USE_MOCK) {
        await mockDelay(800);
        const all = window.SmartTour && window.SmartTour.PLACES ? window.SmartTour.PLACES : [];
        if (!category) return all;
        return all.filter((p) => p.category === category);
    }
    return apiFetch(`/api/places?lat=${destination.lat}&lon=${destination.lon}&category=${encodeURIComponent(category || "")}`, { timeout: 30000 });
}

/* ============================================================
   AI SERVICE  →  /api/ai/chat, /api/ai/plan, /api/ai/modify-itinerary
   ============================================================ */
async function sendAIMessage(message, context, history = []) {
    if (USE_MOCK) {
        await mockDelay(700);
        return mockAIResponse(message, context);
    }
    return apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, context, history: history.slice(-8) }),
        timeout: 20000,
    });
}

async function planTrip(preferences) {
    if (USE_MOCK) {
        await mockDelay(1800);
        return mockItinerary(preferences);
    }
    const data = await apiFetch("/api/ai/plan", { method: "POST", body: JSON.stringify(preferences) });
    return normalizeItinerary(data);
}

async function modifyItinerary(itinerary, weather, instruction) {
    if (USE_MOCK) {
        await mockDelay(1700);
        return mockModifiedItinerary(itinerary, weather, instruction);
    }
    const data = await apiFetch("/api/ai/modify-itinerary", {
        method: "POST",
        body: JSON.stringify({ itinerary, weather, instruction }),
    });
    const normalized = normalizeItinerary(data.itinerary || itinerary);
    return { ...normalized, modified: data.modified || (data.itinerary && data.itinerary.modified) };
}

/* ============================================================
   CURRENCY SERVICE  →  /api/currency
   ============================================================ */
async function convertCurrency(amount, from, to) {
    if (USE_MOCK) {
        await mockDelay(900);
        // Deterministic demo rates keyed by currency pair (demo only).
        const rates = {
            "USD:NPR": 133.5, "NPR:USD": 0.0075,
            "USD:INR": 83.2, "INR:USD": 0.012,
            "USD:EUR": 0.92, "EUR:USD": 1.09,
            "USD:GBP": 0.79, "GBP:USD": 1.27,
            "USD:JPY": 151.5, "JPY:USD": 0.0066,
            "USD:AUD": 1.52, "AUD:USD": 0.66,
            "USD:CAD": 1.36, "CAD:USD": 0.74,
            "NPR:EUR": 0.0069, "EUR:NPR": 145.0,
            "NPR:GBP": 0.0059, "GBP:NPR": 169.0,
            "NPR:JPY": 1.13, "JPY:NPR": 0.88,
            "NPR:AUD": 0.0114, "AUD:NPR": 87.8,
            "NPR:CAD": 0.0102, "CAD:NPR": 98.0,
            "NPR:INR": 0.62, "INR:NPR": 1.61,
        };
        const key = `${from}:${to}`;
        let rate = from === to ? 1 : rates[key];
        if (rate == null) {
            const viaUsdA = rates[`${from}:USD`];
            const viaUsdB = rates[`USD:${to}`];
            if (viaUsdA != null && viaUsdB != null) rate = viaUsdA * viaUsdB;
        }
        if (rate == null) throw new Error(`No demo rate for ${from} to ${to}`);
        const converted = +(amount * rate).toFixed(2);
        return {
            amount,
            from,
            to,
            rate,
            converted,
            updatedAt: new Date().toISOString(),
            source: "demo",
        };
    }
    return apiFetch(`/api/currency?amount=${amount}&from=${from}&to=${to}`);
}

/* ============================================================
   TRANSLATION SERVICE  →  /api/translate
   ============================================================ */
async function translateService(text, targetLang) {
    if (USE_MOCK) {
        await mockDelay(150);
        return window.SmartTour.translateText(text, targetLang);
    }
    return apiFetch("/api/translate", {
        method: "POST",
        body: JSON.stringify({ text, target_lang: targetLang }),
    });
}


function mockAIResponse(message, context) {
    const m = message.toLowerCase();
    const dest = context && context.destination ? context.destination.name : "Pokhara";
    const weather = context && context.weather;

    if (m.includes("culture") || m.includes("tradition") || m.includes("dont")) {
        return `Here's what's worth knowing about ${dest}, Nepal:\n\n🏛️ **Culture & Traditions**\nNepal has a rich heritage shaped by centuries of history, Hinduism, and Buddhism. ${dest} blends natural beauty with deeply rooted local customs. Visitors should respect local etiquette, dress modestly at temples, and ask before taking photos of people.\n\n🍜 **Local Food**\nTry the local specialties here — dal bhat (rice and lentils), momos (dumplings), and regional dishes. Food is central to Nepali hospitality.\n\n✅ **Do** greet with "Namaste" (palms together), remove shoes at temples, and accept chiya (tea) when offered.\n\n🚫 **Avoid** pointing feet at people or sacred objects, and public displays of affection in conservative areas.\n\nThis cultural context is generated by AI (OpenAI in live mode).`;
    }
    if (m.includes("food") || m.includes("eat") || m.includes("restaurant")) {
        return `When in ${dest}, I'd recommend:\n\n🍴 **Must-try local dishes**\n- Momos (dumplings)\n- Dal bhat (lentils & rice)\n- Local curries and fresh produce\n\n🍽️ **Where to eat**\nI can show you nearby restaurants on the map. Select the "Restaurants" category to see real options from OpenStreetMap. Many serve authentic local cuisine.\n\n💡 **Tip:** Ask for the house specialty and always try the local tea or coffee!`;
    }
    if (m.includes("weather") || m.includes("rain") || m.includes("hike")) {
        if (weather) {
            if (weather.condition && weather.condition.toLowerCase().includes("rain")) {
                return `Looking at the real weather for ${dest}: ${weather.condition} with rain expected. Since rain is likely, I recommend indoor activities like museums, cultural sites, cafés, and restaurants. Hiking is better postponed to a clearer day to stay safe and enjoy the views. 🌦️`;
            }
            return `The current weather in ${dest} is **${weather.temp}°C**, ${weather.condition} (feels like ${weather.feelsLike}°C). Humidity is ${weather.humidity}% and wind at ${weather.wind} km/h. It's a good day for outdoor exploration! ☀️`;
        }
        return `The current weather in ${dest} is partly cloudy at 22°C (demo). In live mode, this will use real data from the Weather API via FastAPI.`;
    }
    if (m.includes("atm") || m.includes("money") || m.includes("exchange") || m.includes("bank")) {
        return `I can help you find money services in ${dest}. On the map, select **ATMs**, **Banks**, or **Currency Exchange** to see real locations from OpenStreetMap.\n\n💱 For converting currency, use the Currency Converter above — it uses live exchange rates via the Currency API.`;
    }
    if (m.includes("plan") || m.includes("trip") || m.includes("itinerary") || m.includes("budget")) {
        return `I'd love to plan your trip! Use the **🧳 AI Trip Planner** section to enter your destination, duration, travelers, budget, and interests. I'll create a personalized itinerary for you.\n\nIn live mode, I'll use OpenAI AI combined with real weather, places, and exchange rates to build the perfect plan.`;
    }
    if (m.includes("visit") || m.includes("see") || m.includes("attraction") || m.includes("do")) {
        return `Here are great things to do in ${dest}:\n\n🏛️ **Attractions** — check the map for attractions category.\n📍 **Nearby places** — I've loaded real places on the map.\n\n💡 **Recommendation:** Start with the most iconic landmark, then explore local cafés and markets. Select categories on the map to filter what interests you most!`;
    }
    if (m.includes("budget") || m.includes("$") || m.includes("dollar")) {
        return `To manage your budget well in ${dest}, I recommend:\n\n1. Use the **Currency Converter** to know exactly what your money is worth.\n2. Check the **Trip Planner** to allocate your budget across days.\n3. Find ATMs and exchange centers on the map.\n\nIn live mode, OpenAI AI will build a full budget-aware itinerary using real costs and exchange rates.`;
    }
    return `Great question about ${dest}! 🌍\n\nI can help you with attractions, culture, food, weather, money, and trip planning. Try asking:\n\n- "What should I visit here?"\n- "Tell me about the culture"\n- "What's the weather like?"\n- "Plan a 3-day trip"\n\nIn live mode, I'll use OpenAI AI plus real destination data to give you accurate, personalized answers.`;
}

function mockItinerary(prefs) {
    const { destination, duration = 3, budget = 300, travelers = 2, interests = [] } = prefs;
    const days = [];
    const activitiesPool = {
        Nature: { place: "Lakeside trails", time: "08:00", cost: 15, icon: "🌲" },
        Food: { place: "Local food tour", time: "12:30", cost: 20, icon: "🍜" },
        Culture: { place: "Heritage & temple sites", time: "10:00", cost: 12, icon: "🏛️" },
        History: { place: "Museum & old town", time: "09:30", cost: 10, icon: "📜" },
        Adventure: { place: "Adventure activity", time: "07:00", cost: 40, icon: "🧗" },
        Shopping: { place: "Local market", time: "16:00", cost: 25, icon: "🛍️" },
        Photography: { place: "Sunrise viewpoint", time: "06:00", cost: 8, icon: "📷" },
        Relaxation: { place: "Spa & lakeside café", time: "15:00", cost: 18, icon: "🌅" },
    };
    const themes = interests.length ? interests : ["Nature", "Culture", "Food"];
    for (let i = 0; i < duration; i++) {
        const theme = themes[i % themes.length];
        const acts = [];
        for (let j = 0; j < 3; j++) {
            const keys = Object.keys(activitiesPool);
            const picked = activitiesPool[theme] || activitiesPool[keys[j % keys.length]];
            acts.push({
                time: ["09:00", "12:30", "16:00"][j],
                place: picked.place,
                detail: `${picked.icon} ${picked.place} — a ${theme} experience in ${destination}.`,
                cost: picked.cost,
                transport: j === 0 ? "Walk / local transport" : "Short local ride",
            });
        }
        days.push({ day: i + 1, theme, activities: acts });
    }
    const totalCost = days.flatMap((d) => d.activities).reduce((s, a) => s + a.cost, 0) * travelers;
    return {
        destination,
        duration,
        travelers,
        budget,
        currency: prefs.currency || "USD",
        interests,
        days,
        totalCost,
        remaining: Math.max(0, budget - totalCost),
        note: "Demo itinerary. In live mode, OpenAI AI creates this from real places, weather, and exchange rates.",
    };
}

function mockModifiedItinerary(itinerary, weather, instruction) {
    // Simulate AI adapting the itinerary based on weather.
    const rainLikely = weather && weather.condition && weather.condition.toLowerCase().includes("rain");
    const copy = JSON.parse(JSON.stringify(itinerary));
    if (rainLikely && copy.days && copy.days[1]) {
        copy.days[1].theme = "Indoor & Cultural";
        copy.days[1].activities = [
            { time: "09:30", place: "Indoor museum", detail: "🏛️ Explore the museum — perfect for a rainy day.", cost: 10, transport: "Walk" },
            { time: "12:30", place: "Local café", detail: "🍜 Enjoy local food and warm drinks while it rains.", cost: 15, transport: "Walk" },
            { time: "15:00", place: "Cultural gallery", detail: "🎨 Indoor cultural exhibits and artisan workshops.", cost: 12, transport: "Short ride" },
        ];
        copy.modified = "Day 2 was adapted to indoor activities due to the rain forecast.";
    } else {
        copy.modified = "Based on current conditions, your plan remains unchanged and is suitable for outdoor activities.";
    }
    return copy;
}

// Expose services globally.
window.SmartTour = window.SmartTour || {};
window.SmartTour.services = {
    searchDestinations, getDestination, getWeather, getNearbyPlaces,
    sendAIMessage, planTrip, modifyItinerary, convertCurrency, translateService,
};
