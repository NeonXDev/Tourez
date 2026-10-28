const I18N_DICT = {
    en: {
        nav_explore: "🗺️ Open Map",
        nav_assistant: "AI Travel Assistant",
        nav_planner: "Trip Planner",
nav_currency: "Currency",
        hero_eyebrow: "🌍 One destination. One intelligent assistant.",
        hero_title: "Explore Anywhere. Plan Everything.",
        hero_subtitle: "Your AI-powered travel companion for discovering destinations, understanding local culture, checking real-time conditions, finding essential services, and planning personalized trips.",
        search_placeholder: "Where do you want to explore?",
        use_location: "Use My Location",
        hero_explore_btn: "🗺️ Open Map",
        hero_ask_btn: "🤖 Ask AI",
        stat_dest: "Destinations",
        stat_lang: "Languages",
        stat_cat: "Place Categories",
        stat_ai: "AI Powered",
        explore_title: "Explore Your Destination",
        explore_sub: "Select a destination and explore nearby places, weather, and culture.",
        places_title: "Nearby Places",
        culture_title: "Culture & Traditions",
assistant_title: "🤖 Tourez AI Assistant",
        assistant_sub: "Your intelligent travel companion. Ask anything about this destination.",
        suggested_prompts: "Suggested Prompts",
        clear_chat: "Clear",
        planner_title: "🧳 AI Trip Planner",
        planner_sub: "Tell us your preferences and we'll craft a personalized itinerary with AI.",
        planner_dest: "Destination",
        planner_duration: "Duration (days)",
        planner_travelers: "Travelers",
        planner_budget: "Budget",
        planner_currency: "Currency",
        planner_interests: "Interests",
        planner_empty: "Fill in your preferences and let AI plan your perfect itinerary.",
        currency_title: "💱 Currency Converter",
        currency_sub: "Convert currencies using live exchange rates.",
        currency_amount: "Amount",
        about_title: "About Tourez",
        about_discover: "Discover",
        about_discover_p: "Intelligent destination search with interactive maps.",
        about_check: "Check Weather",
        about_check_p: "Real-time conditions that shape smarter travel plans.",
        about_understand: "Understand Culture",
        about_understand_p: "Local traditions, food, customs, and etiquette explained.",
        about_currency: "Manage Currency",
        about_currency_p: "Live conversion and essential money services nearby.",
        about_ai: "AI Assist",
        about_ai_p: "A companion that plans, adapts, and answers naturally.",
        about_adapt: "Adapt Plans",
        about_adapt_p: "Itineraries adjust when weather or conditions change.",
        footer_tagline: "Discover. Understand. Plan. Explore.",
        footer_note: "© {year} Tourez · Frontend built for FastAPI + OpenAI + live APIs integration."
    },
    ne: { // Nepali (partial illustrative dictionary)
        nav_explore: "अन्वेषण गर्नुहोस्",
        nav_assistant: "AI यात्रा सहायक",
        nav_planner: "यात्रा योजनाकार",
nav_currency: "मुद्रा",
        hero_eyebrow: "🌍 एउटा गन्तव्य। एउटा बुद्धिमानी सहायक।",
        hero_title: "जहाँसुकै अन्वेषण। सबै योजना।",
        hero_subtitle: "गन्तव्य पत्ता लगाउने, स्थानीय संस्कृति बुझ्ने, वास्तविक समयको अवस्था जाँच्ने, आवश्यक सेवाहरू खोज्ने र व्यक्तिगत यात्रा योजना बनाउने तपाईंको AI-संचालित यात्रा साथी।",
        search_placeholder: "कहाँ अन्वेषण गर्न चाहनुहुन्छ?",
        use_location: "मेरो स्थान प्रयोग गर्नुहोस्",
        hero_explore_btn: "गन्तव्य अन्वेषण",
        hero_ask_btn: "🤖 AI सोध्नुहोस्",
        explore_title: "तपाईंको गन्तव्य अन्वेषण",
        explore_sub: "गन्तव्य चयन गरेर नजिकका स्थान, मौसम र संस्कृति अन्वेषण गर्नुहोस्।",
        places_title: "नजिकका स्थानहरू",
        culture_title: "संस्कृति र परम्परा",
        assistant_title: "🤖 Tourez AI सहायक",
        suggested_prompts: "सुझाव प्रश्नहरू",
        planner_title: "🧳 AI यात्रा योजनाकार",
        currency_title: "💱 मुद्रा परिवर्तक",
        about_title: "Tourez बारेमा",
        footer_tagline: "पत्ता लगाउनुहोस्। बुझ्नुहोस्। योजना। अन्वेषण।"
    }
};

function detectLanguage() {
    const nav = (navigator.language || "en").toLowerCase();
    const map = { ne: "ne", hi: "hi", bn: "bn", es: "es", fr: "fr", de: "de", ja: "ja", zh: "zh", "zh-cn": "zh" };
    return map[nav] || "en";
}

async function translateText(text, lang) {
    if (lang === "en") return text;
    try {
        const dict = I18N_DICT[lang] || {};
        if (dict && dict[text]) return dict[text];
        // Simulate network translation latency for demo purposes.
        await new Promise((r) => setTimeout(r, 120));
        return text;
    } catch (e) {
        return text;
    }
}

async function applyLanguage(lang) {
    document.documentElement.lang = lang;
    const dict = I18N_DICT[lang] || {};
    const elements = document.querySelectorAll("[data-i18n]");
    for (const el of elements) {
        const key = el.getAttribute("data-i18n");
        const value = dict[key];
        if (value) {
            el.textContent = value.includes("{year}") ? value.replace("{year}", new Date().getFullYear()) : value;
        }
    }
    const ph = document.querySelectorAll("[data-i18n-ph]");
    for (const el of ph) {
        const key = el.getAttribute("data-i18n-ph");
        if (dict[key]) el.placeholder = dict[key];
    }
}

window.SmartTour = window.SmartTour || {};
window.SmartTour.detectLanguage = detectLanguage;
window.SmartTour.translateText = translateText;
window.SmartTour.applyLanguage = applyLanguage;
