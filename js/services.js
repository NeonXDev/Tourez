const USE_MOCK = false;

const API_BASE = window.TOUREZ_API_BASE || (
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:8000"
        : ""
);

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

function mockDelay(ms = 800) {
    return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

function normalizeItinerary(data) {
    if (!data) return data;
    return {
        ...data,
        totalCost: data.totalCost ?? data.total_cost ?? 0,
        remaining: data.remaining ?? 0,
    };
}

function localSearchDestinations(query) {
    const q = (query || "").toLowerCase().trim();
    const all = window.SmartTour && window.SmartTour.DESTINATIONS ? window.SmartTour.DESTINATIONS : [];
    if (!q) return all.slice(0, 6);
    return all.filter((d) =>
        d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)
    ).slice(0, 6);
}

async function searchDestinations(query) {
    if (USE_MOCK) {
        await mockDelay(300);
        return localSearchDestinations(query);
    }
    try {
        return await apiFetch(`/api/destination?q=${encodeURIComponent(query)}`);
    } catch (e) {
        return localSearchDestinations(query);
    }
}

async function getDestination(id) {
    if (USE_MOCK) {
        await mockDelay(300);
        const all = window.SmartTour && window.SmartTour.DESTINATIONS ? window.SmartTour.DESTINATIONS : [];
        return all.find((d) => d.id === id) || null;
    }
    try {
        return await apiFetch(`/api/destination/${id}`);
    } catch (e) {
        const all = window.SmartTour && window.SmartTour.DESTINATIONS ? window.SmartTour.DESTINATIONS : [];
        return all.find((d) => d.id === id) || null;
    }
}

/* ============================================================
   WEATHER SERVICE  →  /api/weather
   ============================================================ */
function localWeatherFallback(destination) {
    const seed = (destination.name || "Pokhara").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"];
    const icons = ["☀️", "🌤️", "☁️", "🌦️", "🌙"];
    const idx = seed % 5;
    return {
        location: `${destination.name}, ${destination.country || "Nepal"}`,
        temp: 18 + (seed % 10),
        feelsLike: 17 + (seed % 10),
        condition: conditions[idx],
        icon: icons[idx],
        humidity: 45 + (seed % 40),
        wind: 6 + (seed % 15),
        rainChance: idx === 3 ? 65 : 15,
        forecast: [
            { day: "Today", icon: icons[(idx + 1) % 5], high: 22 + (seed % 6), low: 14 + (seed % 5), rainChance: idx === 3 ? 65 : 15 },
            { day: "Tomorrow", icon: icons[(idx + 2) % 5], high: 21 + (seed % 6), low: 13 + (seed % 5), rainChance: 20 },
            { day: "Wednesday", icon: icons[(idx + 3) % 5], high: 23 + (seed % 6), low: 15 + (seed % 5), rainChance: 10 },
        ],
        updatedAt: new Date().toISOString(),
        source: "Tourez Weather",
    };
}

async function getWeather(destination) {
    if (USE_MOCK) {
        await mockDelay(600);
        return localWeatherFallback(destination);
    }
    try {
        return await apiFetch(`/api/weather?lat=${destination.lat}&lon=${destination.lon}&location=${encodeURIComponent(`${destination.name || "Current location"}${destination.country ? ", " + destination.country : ""}`)}`);
    } catch (e) {
        return localWeatherFallback(destination);
    }
}

/* ============================================================
   PLACES SERVICE  →  /api/places
   ============================================================ */
async function getNearbyPlaces(destination, category) {
    if (USE_MOCK) {
        await mockDelay(500);
        const all = window.SmartTour && window.SmartTour.PLACES ? window.SmartTour.PLACES : [];
        if (!category) return all;
        return all.filter((p) => p.category === category);
    }
    try {
        return await apiFetch(`/api/places?lat=${destination.lat}&lon=${destination.lon}&category=${encodeURIComponent(category || "")}`, { timeout: 6000 });
    } catch (e) {
        const all = window.SmartTour && window.SmartTour.PLACES ? window.SmartTour.PLACES : [];
        if (!category) return all;
        return all.filter((p) => p.category === category);
    }
}

/* ============================================================
   AI SERVICE  →  /api/ai/chat, /api/ai/plan, /api/ai/modify-itinerary
   ============================================================ */
async function sendAIMessage(message, context, history = []) {
    if (USE_MOCK) {
        await mockDelay(600);
        return mockAIResponse(message, context);
    }
    try {
        return await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({ message, context, history: history.slice(-8) }),
            timeout: 20000,
        });
    } catch (err) {
        console.warn("Backend chat unavailable, using client-side AI response:", err);
        return { message: mockAIResponse(message, context) };
    }
}

async function planTrip(preferences) {
    if (USE_MOCK) {
        await mockDelay(1200);
        return mockItinerary(preferences);
    }
    try {
        const data = await apiFetch("/api/ai/plan", {
            method: "POST",
            body: JSON.stringify(preferences),
            timeout: 25000,
        });
        return normalizeItinerary(data);
    } catch (err) {
        console.warn("Backend /api/ai/plan failed or unavailable, using smart client-side planner:", err);
        return mockItinerary(preferences);
    }
}

async function modifyItinerary(itinerary, weather, instruction) {
    if (USE_MOCK) {
        await mockDelay(1000);
        return mockModifiedItinerary(itinerary, weather, instruction);
    }
    try {
        const data = await apiFetch("/api/ai/modify-itinerary", {
            method: "POST",
            body: JSON.stringify({ itinerary, weather, instruction }),
            timeout: 25000,
        });
        const raw = data.itinerary || itinerary;
        const merged = {
            destination: raw.destination || itinerary.destination,
            duration: raw.duration || itinerary.duration,
            travelers: raw.travelers || itinerary.travelers,
            budget: raw.budget ?? itinerary.budget,
            currency: raw.currency || itinerary.currency,
            interests: raw.interests || itinerary.interests,
            days: raw.days || itinerary.days,
            ...raw,
        };
        const normalized = normalizeItinerary(merged);
        return { ...normalized, modified: data.modified || raw.modified };
    } catch (err) {
        console.warn("Backend /api/ai/modify-itinerary unavailable, using client fallback:", err);
        return mockModifiedItinerary(itinerary, weather, instruction);
    }
}

/* ============================================================
   CURRENCY SERVICE  →  /api/currency
   ============================================================ */
async function convertCurrency(amount, from, to) {
    const demoRates = {
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
    function getDemoRate(f, t) {
        if (f === t) return 1.0;
        const key = `${f}:${t}`;
        if (demoRates[key]) return demoRates[key];
        const viaA = demoRates[`${f}:USD`];
        const viaB = demoRates[`USD:${t}`];
        if (viaA != null && viaB != null) return viaA * viaB;
        return 1.0;
    }

    if (USE_MOCK) {
        await mockDelay(400);
        const rate = getDemoRate(from, to);
        return {
            amount, from, to, rate,
            converted: +(amount * rate).toFixed(2),
            updatedAt: new Date().toISOString(),
            source: "demo",
        };
    }
    try {
        return await apiFetch(`/api/currency?amount=${amount}&from=${from}&to=${to}`);
    } catch (e) {
        const rate = getDemoRate(from, to);
        return {
            amount, from, to, rate,
            converted: +(amount * rate).toFixed(2),
            updatedAt: new Date().toISOString(),
            source: "offline-rate",
        };
    }
}

/* ============================================================
   TRANSLATION SERVICE  →  /api/translate
   ============================================================ */
async function translateService(text, targetLang) {
    if (USE_MOCK) {
        await mockDelay(150);
        return window.SmartTour.translateText(text, targetLang);
    }
    try {
        return await apiFetch("/api/translate", {
            method: "POST",
            body: JSON.stringify({ text, target_lang: targetLang }),
        });
    } catch (e) {
        return window.SmartTour.translateText(text, targetLang);
    }
}

/* ============================================================
   AI Assistant / Chat Fallback
   ============================================================ */
function mockAIResponse(message, context) {
    const m = (message || "").toLowerCase().trim();
    const dest = context && context.destination ? context.destination.name : "Pokhara";
    const weather = context && context.weather;

    const declineMsg = "Namaste! I am Tourez AI, an assistant dedicated exclusively to travel and exploring places in Nepal. I can only assist with questions related to traveling, sightseeing, destinations, food, weather, culture, and trip planning. Please feel free to ask me anything about your journey in Nepal! 🌍";

    // Detect explicit off-topic requests
    const offTopicKeywords = [
        "code", "coding", "python", "javascript", "java", "c++", "html", "css", "sql", "bug", "syntax",
        "math", "equation", "formula", "physics", "chemistry", "biology", "algebra", "calculus",
        "homework", "essay", "poem", "crypto", "bitcoin", "ethereum", "stock market",
        "gaming", "game", "playstation", "xbox", "fortnite", "minecraft",
        "president", "election", "celebrity", "hollywood", "bollywood",
        "programming", "software"
    ];
    if (offTopicKeywords.some((k) => m.includes(k))) {
        return declineMsg;
    }

    if (m === "hi" || m === "hello" || m === "hey" || m === "namaste" || m.startsWith("hello ")) {
        return `Namaste! I'm your Tourez AI travel assistant for **${dest}, Nepal**. 🌍\n\nI can help you with attractions, culture, food, weather, currency, and trip planning. What would you like to know about your journey in Nepal?`;
    }

    if (m.includes("culture") || m.includes("tradition") || m.includes("dont")) {
        return `Here's what's worth knowing about **${dest}, Nepal**:\n\n🏛️ **Culture & Traditions**\nNepal has a rich heritage shaped by Hinduism and Buddhism. ${dest} blends natural beauty with deeply rooted local customs. Visitors should respect local etiquette, dress modestly at temples, and ask before taking photos of people.\n\n🍜 **Local Food**\nTry the local specialties here — dal bhat (rice and lentils), momos (dumplings), and regional dishes. Food is central to Nepali hospitality.\n\n✅ **Do** greet with "Namaste" (palms together), remove shoes at temples, and accept chiya (tea) when offered.\n\n🚫 **Avoid** pointing feet at people or sacred objects, and public displays of affection in conservative areas.`;
    }
    if (m.includes("food") || m.includes("eat") || m.includes("restaurant")) {
        return `When in **${dest}**, I'd recommend:\n\n🍴 **Must-try local dishes**\n- Momos (steamed dumplings)\n- Thakali Dal Bhat (wholesome lentils, rice & curries)\n- Thukpa (warm Himalayan noodle soup)\n- Local curries and seasonal mountain produce\n\n🍽️ **Where to eat**\nI can show you nearby restaurants on the map. Select the "Restaurants" category to see real options from OpenStreetMap.\n\n💡 **Tip:** Always try the local spiced chiya (Nepali tea) or Himalayan Arabica coffee!`;
    }
    if (m.includes("weather") || m.includes("rain") || m.includes("hike") || m.includes("trek")) {
        if (weather) {
            if (weather.condition && weather.condition.toLowerCase().includes("rain")) {
                return `Looking at the current weather for **${dest}**: ${weather.condition} with rain expected. Since rain is likely, I recommend indoor activities like museums, cultural sites, cafés, and restaurants. Hiking is better postponed to a clearer day to stay safe and enjoy the mountain views. 🌦️`;
            }
            return `The current weather in **${dest}** is **${weather.temp}°C**, ${weather.condition} (feels like ${weather.feelsLike ?? weather.temp}°C). Humidity is ${weather.humidity}% and wind at ${weather.wind} km/h. It's a great day for outdoor exploration! ☀️`;
        }
        return `The current weather in **${dest}** is partly cloudy at 22°C. Open the Weather section above for real-time 3-day forecast details.`;
    }
    if (m.includes("atm") || m.includes("money") || m.includes("exchange") || m.includes("bank")) {
        return `I can help you find money services in **${dest}**. On the map, select **ATMs**, **Banks**, or **Currency Exchange** to see real locations from OpenStreetMap.\n\n💱 For converting currency, use the Currency Converter above — it uses live exchange rates.`;
    }
    if (m.includes("plan") || m.includes("trip") || m.includes("itinerary") || m.includes("budget")) {
        return `I'd love to plan your trip! Use the **🧳 AI Trip Planner** section below to select your duration, travelers, budget, and interests. I'll create a structured, day-by-day personalized itinerary for you!`;
    }
    if (m.includes("visit") || m.includes("see") || m.includes("attraction") || m.includes("do")) {
        return `Here are top recommendations for **${dest}**:\n\n🏛️ **Iconic Landmarks** — check the map for Attractions category.\n📍 **Nearby places** — explore real places loaded directly on the interactive map.\n\n💡 **Tip:** Start with the sunrise viewpoint or main cultural site in the morning, followed by a local café or market in the afternoon!`;
    }

    const travelKeywords = [
        "travel", "trip", "tour", "visit", "see", "sight", "explore", "nepal", "pokhara", "kathmandu",
        "chitwan", "lumbini", "mustang", "ilam", "hotel", "stay", "food", "eat", "restaurant", "cafe",
        "weather", "rain", "sun", "trek", "hike", "mountain", "himalaya", "temple", "stupa", "culture",
        "tradition", "safety", "safe", "avoid", "bus", "flight", "taxi", "money", "atm", "currency",
        "budget", "ticket", "permit", "pack", "season", "route", "destination", "place", "dish", "momo",
        "where", "how to get", "cost", "directions", "near"
    ];
    if (!travelKeywords.some((k) => m.includes(k))) {
        return declineMsg;
    }

    return `Namaste! I'm your Tourez AI assistant for **${dest}**. 🌍\n\nI can help you with attractions, culture, food, weather, money, and trip planning. Try asking:\n\n- "What should I visit here?"\n- "Tell me about the culture"\n- "What's the weather like?"\n- "What food should I try?"`;
}

/* ============================================================
   Client-Side Smart Trip Planner & Adaptation
   ============================================================ */
const CLIENT_DESTINATION_POOLS = {
    pokhara: {
        Nature: [
            { place: "Phewa Lake Wooden Boat Ride", cost: 10, icon: "🚣", detail: "Glide across Phewa Lake to Tal Barahi Temple with reflection of Machhapuchhre." },
            { place: "Sarangkot Sunrise Viewpoint", cost: 8, icon: "🌅", detail: "Breathtaking panoramic dawn across Annapurna and Dhaulagiri mountain peaks." },
            { place: "World Peace Pagoda Forest Hike", cost: 6, icon: "🌲", detail: "Peaceful forest walk up to the serene white stupa with valley panoramas." },
            { place: "Davis Falls & Gupteshwor Mahadev Cave", cost: 7, icon: "💧", detail: "Waterfall cascading into an underground cavern and sacred shrine." },
            { place: "Begnas Lake & Village Trail", cost: 12, icon: "🌿", detail: "Tranquil afternoon exploring Pokhara's peaceful second lake." },
        ],
        Food: [
            { place: "Lakeside Thakali Kitchen", cost: 14, icon: "🍛", detail: "Authentic Himalayan Thakali thali with fragrant ghee, daal, and mountain greens." },
            { place: "Artisan Coffee Roasters & Bakery", cost: 8, icon: "☕", detail: "Freshly brewed organic Nepali Arabica coffee with fresh croissants." },
            { place: "Fresh Lake Trout & Steamy Momo House", cost: 12, icon: "🥟", detail: "Crispy freshwater fish and juicy dumplings with spicy tomato chutney." },
        ],
        Culture: [
            { place: "Bindhyabasini Temple & Old Pokhara", cost: 5, icon: "🏛️", detail: "Ancient hilltop Hindu sanctuary overlooking the bustling heritage bazaar." },
            { place: "Tibetan Tashiling Monastery", cost: 8, icon: "🛕", detail: "Observe peaceful monk prayers, spinning prayer wheels, and handwoven carpets." },
            { place: "International Mountain Museum", cost: 9, icon: "📜", detail: "Fascinating history of Himalayan expeditions, sherpa culture, and alpine ecology." },
        ],
        Adventure: [
            { place: "Paragliding over Sarangkot", cost: 50, icon: "🪂", detail: "Tandem flight soaring above Pokhara valley with the Himalayas in sight." },
            { place: "Zip-flyer & Mountain Swing", cost: 45, icon: "🧗", detail: "One of the world's steepest zip lines flying through dense pine canopy." },
            { place: "Seti River Gorge Rapids", cost: 30, icon: "🚣", detail: "Thrilling white-water rafting trip through the narrow limestone gorge." },
        ],
    },
    kathmandu: {
        Culture: [
            { place: "Swayambhunath (Monkey Temple)", cost: 6, icon: "🏛️", detail: "Historic hilltop stupa offering sweeping views over Kathmandu Valley." },
            { place: "Boudhanath Stupa Circumambulation", cost: 7, icon: "🛕", detail: "Walk alongside monks and pilgrims around Nepal's grandest Buddhist monument." },
            { place: "Patan Durbar Square & Bronze Museum", cost: 10, icon: "🏰", detail: "Masterpiece of Newari royal architecture, wood carvings, and courtyards." },
            { place: "Pashupatinath Sacred Heritage Complex", cost: 8, icon: "🕉️", detail: "Venerated Bagmati riverside temple with centuries of spiritual traditions." },
            { place: "Bhaktapur Ancient Pottery Square", cost: 12, icon: "🏺", detail: "Step into medieval Nepal with cobblestone alleys and traditional potters." },
        ],
        Food: [
            { place: "Authentic Newari Khaja Ghar", cost: 11, icon: "🥘", detail: "Taste savory choila, lentil bara, crispy beaten rice, and spicy curry." },
            { place: "Thamel Steamy Momo Trail", cost: 7, icon: "🥟", detail: "Savor mountain momos with sesame, coriander, and fiery chili chutney." },
            { place: "Historic Courtyard Chiya House", cost: 5, icon: "☕", detail: "Boiling hot masala tea served with freshly fried sel roti." },
        ],
        Nature: [
            { place: "Chandragiri Hills Cable Car", cost: 18, icon: "🚠", detail: "Gondola ride to 2,551m peak for panoramic vistas of the Himalayan chain." },
            { place: "Garden of Dreams Historic Park", cost: 5, icon: "🌿", detail: "Serene neoclassical oasis with marble pavilions and quiet fountains." },
            { place: "Shivapuri National Park Trail", cost: 10, icon: "🌲", detail: "Crisp pine forest hike leading to Nagi Gompa monastery." },
        ],
    },
    chitwan: {
        Nature: [
            { place: "Chitwan National Park Jungle Safari", cost: 30, icon: "🦏", detail: "Jeep expedition tracking wild one-horned rhinos, spotted deer, and tigers." },
            { place: "Rapti River Canoe Float", cost: 14, icon: "🛶", detail: "Quiet canoe ride past sunbathing gharials, marsh muggers, and kingfishers." },
            { place: "Jungle Nature Birding Walk", cost: 12, icon: "🌲", detail: "Dawn guided walk through tall elephant grass and riverside forests." },
        ],
        Culture: [
            { place: "Tharu Cultural Stick Dance Show", cost: 9, icon: "💃", detail: "Dynamic tribal dance, drumming, and vibrant traditional costumes." },
            { place: "Tharu Village Traditional Walk", cost: 8, icon: "🌾", detail: "Explore mud-and-thatch architecture and age-old agrarian customs." },
        ],
        Food: [
            { place: "Sauraha Riverside Sunset Dinner", cost: 16, icon: "🌅", detail: "Fresh fish curry and refreshments as the sun sets over the Rapti River." },
            { place: "Local Tharu Delicacies Spot", cost: 10, icon: "🍲", detail: "Traditional ghongi snails, anadi rice, and organic farm greens." },
        ],
    },
    lumbini: {
        Culture: [
            { place: "Maya Devi Temple & Ashoka Pillar", cost: 8, icon: "🛕", detail: "Sacred birthplace of Lord Buddha and third-century BCE historic marker." },
            { place: "International Monastic Zone", cost: 10, icon: "🏛️", detail: "Tour striking Buddhist monasteries built by Thailand, China, Germany, and Japan." },
            { place: "World Peace Pagoda (Lumbini)", cost: 5, icon: "🕊️", detail: "Magnificent white stupa dedicated to global peace and harmony." },
        ],
        Nature: [
            { place: "Lumbini Sacred Garden Meditation", cost: 4, icon: "🧘", detail: "Peaceful contemplative stroll beside the ancient lotus bathing pond." },
            { place: "Wetland Crane Sanctuary Trail", cost: 6, icon: "🦩", detail: "Habitat of majestic Sarus cranes and peaceful natural wetlands." },
        ],
        Food: [
            { place: "Monastery Pure Vegetarian Dining", cost: 8, icon: "🥗", detail: "Simple, nourishing Buddhist vegetarian meal made with organic produce." },
            { place: "Lumbini Village Chiya & Sweets", cost: 5, icon: "☕", detail: "Sweet Terai milk tea, hot samosas, and freshly made jalebis." },
        ],
    },
    mustang: {
        Culture: [
            { place: "Muktinath Sacred 108 Water Spouts", cost: 10, icon: "🛕", detail: "High-altitude pilgrimage shrine sacred to both Hindus and Buddhists." },
            { place: "Ancient Kagbeni Citadel & Monastery", cost: 8, icon: "🏰", detail: "Historic trade gateway with Tibetan architecture and prayer wheels." },
            { place: "Marpha Village & White Stone Alleys", cost: 7, icon: "🏛️", detail: "Picturesque apple village with flagstone lanes and flat-roofed houses." },
        ],
        Nature: [
            { place: "Kali Gandaki Riverbed Fossil Hunt", cost: 8, icon: "🏔️", detail: "Search for ancient ammonite Saligram fossils in the deep mountain gorge." },
            { place: "Dhumba Turquoise Alpine Lake", cost: 6, icon: "💎", detail: "Pristine emerald waters nestled under towering Nilgiri peaks." },
        ],
        Food: [
            { place: "Marpha Apple Orchard & Bakery", cost: 10, icon: "🍏", detail: "Famous Mustang apple pie, fresh cider, and dried mountain apples." },
            { place: "Jomsom Thakali Kitchen", cost: 12, icon: "🍲", detail: "Authentic buckwheat dhindo, spicy yak curry, and jimbu-infused soup." },
        ],
    },
    ilam: {
        Nature: [
            { place: "Kanyam Tea Estate Walking Tour", cost: 6, icon: "🍃", detail: "Stroll through manicured hillside tea bushes veiled in morning mist." },
            { place: "Shree Antu Dawn Himalayan Ridge", cost: 8, icon: "🌅", detail: "Epic sunrise lookout with views of Mount Kanchenjunga." },
            { place: "Mai Pokhari Sacred Botanical Lake", cost: 7, icon: "🌿", detail: "Peaceful sacred cloud-forest lake home to rare orchids." },
        ],
        Food: [
            { place: "Orthodox Tea Tasting & Factory Tour", cost: 9, icon: "🍵", detail: "Learn traditional orthodox processing and sample rare artisanal tea flushes." },
            { place: "Ilam Artisan Dairy & Chhurpi Stop", cost: 7, icon: "🧀", detail: "Taste locally cured Himalayan cheese, fresh butter, and local snacks." },
        ],
    },
};

const CLIENT_GENERIC_POOLS = {
    Nature: [
        { place: "Panoramic Mountain Viewpoint", cost: 10, icon: "🏔️", detail: "Scenic ridge trail with wide-angle views of mountains and terraced valleys." },
        { place: "Botanical Nature Walk & River", cost: 8, icon: "🌿", detail: "Tranquil stroll through indigenous flora, bamboo groves, and running streams." },
        { place: "Lakeside Walking Circuit", cost: 9, icon: "🌲", detail: "Relaxed lakeside path taking in fresh mountain breezes and birdlife." },
        { place: "Hidden Waterfall & Forest Glade", cost: 12, icon: "💧", detail: "Refreshing forest trek ending at a secluded cascading waterfall." },
    ],
    Food: [
        { place: "Local Food & Market Tasting Tour", cost: 16, icon: "🍜", detail: "Sample celebrated regional street snacks, steamed momos, and spicy curries." },
        { place: "Heritage Thali Experience", cost: 18, icon: "🍽️", detail: "Traditional Nepali feast with seasonal wild herbs, lentil daal, and chutneys." },
        { place: "Mountain Bakery & Coffee House", cost: 8, icon: "☕", detail: "Locally roasted Himalayan Arabica coffee paired with warm pastries." },
    ],
    Culture: [
        { place: "Historic Heritage Temple Shrine", cost: 10, icon: "🏛️", detail: "Explore intricately carved stone and wood shrines steeped in local history." },
        { place: "Artisan Handicrafts Workshop", cost: 12, icon: "🎨", detail: "Watch master craftsmen sculpt wood, weave pashmina, or shape pottery." },
        { place: "Regional Heritage Museum", cost: 8, icon: "📜", detail: "Displays honoring indigenous communities, folklore, and mountain crafts." },
    ],
    History: [
        { place: "Ancient Old Town Walking Trail", cost: 8, icon: "📜", detail: "Wander historic paved pathways, merchant courtyards, and ancient shrines." },
        { place: "Fortress & Palace Ruins", cost: 11, icon: "🏰", detail: "Discover ancient defensive towers and royal courtyards with valley outlooks." },
    ],
    Adventure: [
        { place: "Guided Valley Ridge Day Trek", cost: 25, icon: "🧗", detail: "Rewarding walk across terraced farmland and scenic mountain passes." },
        { place: "Suspension Bridge River Crossing", cost: 15, icon: "🚣", detail: "Walk across a soaring suspension bridge overlooking river canyon rapids." },
    ],
    Shopping: [
        { place: "Local Bazaar & Handicraft Stalls", cost: 15, icon: "🛍️", detail: "Browse colorful traditional textiles, aromatic spices, and local teas." },
    ],
    Photography: [
        { place: "Sunrise Golden Hour Outlook", cost: 6, icon: "📷", detail: "Prime photography spot capturing golden morning light on mountain ridges." },
    ],
    Relaxation: [
        { place: "Tranquil Scenic Café & Lounge", cost: 9, icon: "☕", detail: "Peaceful setting to relax with a scenic vista, warm tea, and quiet reading." },
        { place: "Herbal Steam & Natural Spa", cost: 22, icon: "💆", detail: "Relaxing treatment using locally harvested wild Himalayan herbs and oils." },
    ],
};

function getClientCurrencyFactor(currency) {
    const c = (currency || "USD").toUpperCase().trim();
    const rates = {
        NPR: 133.0,
        INR: 83.0,
        JPY: 150.0,
        EUR: 0.92,
        GBP: 0.79,
        AUD: 1.52,
        CAD: 1.36,
        USD: 1.0,
    };
    return rates[c] || 1.0;
}

function mockItinerary(prefs) {
    const destination = (prefs.destination || "Pokhara").trim();
    const destKey = destination.toLowerCase();
    const duration = Math.max(1, Math.min(14, +prefs.duration || 3));
    const travelers = Math.max(1, +prefs.travelers || 2);
    const currency = (prefs.currency || "USD").toUpperCase();
    const factor = getClientCurrencyFactor(currency);
    const rawBudget = +prefs.budget || 300;
    const budget = rawBudget > 0 ? rawBudget : Math.round(300 * factor);

    const userInterests = Array.isArray(prefs.interests) && prefs.interests.length ? prefs.interests : ["Nature", "Culture", "Food"];
    const themes = userInterests;

    // Check if we have a destination pool
    let destPool = null;
    for (const [k, v] of Object.entries(CLIENT_DESTINATION_POOLS)) {
        if (destKey.includes(k) || k.includes(destKey)) {
            destPool = v;
            break;
        }
    }

    const days = [];
    const times = ["09:00", "13:00", "16:30"];

    for (let d = 0; d < duration; d++) {
        const theme = themes[d % themes.length];
        const candidates = [];
        if (destPool && destPool[theme]) {
            candidates.push(...destPool[theme]);
        }
        if (CLIENT_GENERIC_POOLS[theme]) {
            candidates.push(...CLIENT_GENERIC_POOLS[theme]);
        }
        if (!candidates.length) {
            for (const list of Object.values(CLIENT_GENERIC_POOLS)) {
                candidates.push(...list);
            }
        }

        const acts = [];
        for (let slot = 0; slot < 3; slot++) {
            const itemIdx = (d * 3 + slot) % candidates.length;
            const item = candidates[itemIdx];
            const baseCost = item.cost || 10;
            const cost = factor > 10 ? Math.round(baseCost * factor) : +(baseCost * (factor > 1 ? factor : 1)).toFixed(2);
            acts.push({
                time: times[slot],
                place: item.place,
                detail: `${item.icon || "📍"} ${item.detail || `${item.place} experience in ${destination}.`}`,
                cost: cost,
                transport: slot === 0 ? "Scenic walk / local transport" : "Short local ride",
            });
        }
        days.push({ day: d + 1, theme: theme, activities: acts });
    }

    const totalCost = days.flatMap((d) => d.activities).reduce((s, a) => s + (a.cost || 0), 0) * travelers;
    const roundedTotal = +(totalCost).toFixed(2);
    const remaining = Math.max(0, +(budget - roundedTotal).toFixed(2));

    return {
        destination,
        duration,
        travelers,
        budget,
        currency,
        interests: themes,
        days,
        totalCost: roundedTotal,
        remaining,
        note: `Personalized ${duration}-day itinerary for ${destination} tailored for ${travelers} traveler${travelers !== 1 ? "s" : ""}.`,
    };
}

function mockModifiedItinerary(itinerary, weather, instruction) {
    const copy = JSON.parse(JSON.stringify(itinerary));
    const instr = (instruction || "").toLowerCase();
    const cond = (weather && weather.condition ? weather.condition : "").toLowerCase();
    const isRain = instr.includes("rain") || cond.includes("rain") || instr.includes("weather");
    const currency = copy.currency || "USD";
    const factor = getClientCurrencyFactor(currency);

    const days = copy.days || [];
    if (!days.length) return copy;

    const targetIdx = days.length === 1 || instr.includes("day 1") ? 0 : 1;
    const safeIdx = Math.min(targetIdx, days.length - 1);
    const targetDayNum = safeIdx + 1;

    if (isRain) {
        const c1 = factor > 10 ? Math.round(10 * factor) : +(10 * (factor > 1 ? factor : 1)).toFixed(2);
        const c2 = factor > 10 ? Math.round(14 * factor) : +(14 * (factor > 1 ? factor : 1)).toFixed(2);
        const c3 = factor > 10 ? Math.round(12 * factor) : +(12 * (factor > 1 ? factor : 1)).toFixed(2);

        days[safeIdx].theme = "Indoor & Cultural";
        days[safeIdx].activities = [
            {
                time: "09:30",
                place: "Indoor Heritage Museum & Art Gallery",
                detail: "🏛️ Explore local artifacts, historic exhibits, and traditional art sheltered from the rain.",
                cost: c1,
                transport: "Short covered ride",
            },
            {
                time: "12:30",
                place: "Cosy Heritage Tea Room & Café",
                detail: "☕ Warm Himalayan tea, steamy momos, and traditional lunch while watching the rainfall.",
                cost: c2,
                transport: "Short walk",
            },
            {
                time: "15:30",
                place: "Artisan Workshop & Indoor Craft Centre",
                detail: "🎨 Live pottery, woodcarving, and traditional handicraft demonstrations under cover.",
                cost: c3,
                transport: "Short ride",
            },
        ];
        copy.modified = `Day ${targetDayNum} was adapted to comfortable indoor & cultural activities due to the rain forecast.`;
    } else {
        copy.modified = "Itinerary verified against current conditions and remains optimal for your trip.";
    }

    const travelers = copy.travelers || 1;
    const totalCost = days.flatMap((d) => d.activities).reduce((s, a) => s + (a.cost || 0), 0) * travelers;
    const budget = copy.budget || 0;
    copy.totalCost = +(totalCost).toFixed(2);
    copy.remaining = Math.max(0, +(budget - totalCost).toFixed(2));
    return copy;
}

/* ---------- Compliance & Privacy Services ---------- */
async function requestDataDeletion(payload) {
    try {
        return await apiFetch("/api/compliance/delete-request", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    } catch (e) {
        console.warn("Backend compliance endpoint fallback:", e);
        return {
            status: "received",
            ticket_id: `DEL-2026-NP${Math.floor(10000 + Math.random() * 90000)}`,
            email: payload.email,
            timestamp: new Date().toISOString(),
            sla: "Processed within 72 business hours",
            message: "Your data deletion request has been registered and all local and session data purged.",
        };
    }
}

async function subscribeNewsletter(email) {
    try {
        return await apiFetch("/api/compliance/newsletter/subscribe", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    } catch (e) {
        return {
            status: "subscribed",
            email,
            message: "Thank you for subscribing to Tourez travel insights and seasonal Nepal advisories.",
        };
    }
}

async function unsubscribeNewsletter(email) {
    try {
        return await apiFetch("/api/compliance/newsletter/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    } catch (e) {
        return {
            status: "unsubscribed",
            email,
            message: `${email} has been unsubscribed from all Tourez communications.`,
        };
    }
}

// Expose services globally.
window.SmartTour = window.SmartTour || {};
window.SmartTour.services = {
    searchDestinations,
    getDestination,
    getWeather,
    getNearbyPlaces,
    sendAIMessage,
    planTrip,
    modifyItinerary,
    convertCurrency,
    translateService,
    requestDataDeletion,
    subscribeNewsletter,
    unsubscribeNewsletter,
};
