document.addEventListener("DOMContentLoaded", () => {
    if (!window.SmartTour) window.SmartTour = {};

    const savedLang = localStorage.getItem("smartTourLang");
    if (savedLang) {
        const sel = document.getElementById("langSelect");
        if (sel) sel.value = savedLang;
        if (window.SmartTour.applyLanguage) window.SmartTour.applyLanguage(savedLang);
    } else if (window.SmartTour.detectLanguage) {
        const detected = window.SmartTour.detectLanguage();
        const sel = document.getElementById("langSelect");
        if (sel) {
            sel.value = detected;
            window.SmartTour.applyLanguage(detected);
        }
    }

    const theme = localStorage.getItem("smartTourTheme") || "light";
    document.documentElement.setAttribute("data-theme", theme);

    const mapEl = document.getElementById("travelMap");
    if (mapEl && window.SmartTour.MapKit) {
        const mapInstance = window.SmartTour.MapKit.init(mapEl);
        if (mapInstance) {
            window.SmartTour.mapInstance = mapInstance;
            mapInstance.onPlaceClick((place) => mapInstance.openPopup(place));
        }
    }

    if (window.SmartTour.UI) window.SmartTour.UI.init();
    if (window.SmartTour.AIChat) window.SmartTour.AIChat.init();
    if (window.SmartTour.CurrencyKit) window.SmartTour.CurrencyKit.init();
    if (window.SmartTour.WalletKit) window.SmartTour.WalletKit.init();
});

document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "langSelect") {
        localStorage.setItem("smartTourLang", e.target.value);
    }
});
