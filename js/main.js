document.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem("smartTourLang");
    if (savedLang) {
        const sel = document.getElementById("langSelect");
        if (sel) sel.value = savedLang;
        window.SmartTour.applyLanguage(savedLang);
    } else {
        const detected = window.SmartTour.detectLanguage();
        const sel = document.getElementById("langSelect");
        if (sel) {
            sel.value = detected;
            window.SmartTour.applyLanguage(detected);
        }
    }

    // Initialize theme toggle state.
    const theme = localStorage.getItem("smartTourTheme") || "light";
    document.documentElement.setAttribute("data-theme", theme);

    // Initialize interactive map.
    const mapEl = document.getElementById("travelMap");
    if (mapEl && window.SmartTour.MapKit) {
        const mapInstance = window.SmartTour.MapKit.init(mapEl);
        if (mapInstance) {
            window.SmartTour.mapInstance = mapInstance;
            mapInstance.onPlaceClick((place) => mapInstance.openPopup(place));
        }
    }

    window.SmartTour.UI.init();
    window.SmartTour.AIChat.init();
    window.SmartTour.CurrencyKit.init();
    if (window.SmartTour.WalletKit) window.SmartTour.WalletKit.init();
});

document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "langSelect") {
        localStorage.setItem("smartTourLang", e.target.value);
    }
});
