const UI = (function () {
    let currentDestination = null;
    let currentPlaces = [];
    let activeCategory = null;
    let searchResults = [];

    /* ---------- Toast ---------- */
    function showToast(msg, type = "info") {
        const wrap = document.getElementById("toastContainer");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        wrap.appendChild(toast);
        setTimeout(() => {
            toast.classList.add("hide");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /* ---------- Theme ---------- */
    function initTheme() {
        const saved = localStorage.getItem("smartTourTheme");
        if (saved) document.documentElement.setAttribute("data-theme", saved);
        const btn = document.getElementById("themeToggle");
        btn.addEventListener("click", () => {
            const cur = document.documentElement.getAttribute("data-theme");
            const next = cur === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem("smartTourTheme", next);
        });
    }

    /* ---------- Navbar scroll + mobile menu ---------- */
    function initNav() {
        const nav = document.getElementById("navbar");
        const hamburger = document.getElementById("hamburger");
        const navLinks = document.getElementById("navLinks");
        window.addEventListener("scroll", () => {
            nav.classList.toggle("scrolled", window.scrollY > 40);
        });
        hamburger.addEventListener("click", () => {
            const open = navLinks.classList.toggle("open");
            hamburger.classList.toggle("open", open);
            hamburger.setAttribute("aria-expanded", open);
        });
        navLinks.querySelectorAll(".nav-link").forEach((a) =>
            a.addEventListener("click", () => {
                navLinks.classList.remove("open");
                hamburger.classList.remove("open");
            })
        );
    }

    /* ---------- Language ---------- */
    function initLanguage() {
        const sel = document.getElementById("langSelect");
        sel.addEventListener("change", async () => {
            const lang = sel.value;
            await window.SmartTour.applyLanguage(lang);
            showToast(`🌐 Language: ${lang.toUpperCase()}`);
        });
    }

    /* ---------- Destination Chips + Search ---------- */
    function attachChipHandlers() {
        document.querySelectorAll(".destination-chips .chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                document.querySelectorAll(".destination-chips .chip").forEach((c) => c.classList.remove("active"));
                chip.classList.add("active");
                const d = window.SmartTour.DESTINATIONS.find((x) => x.name === chip.dataset.dest);
                if (d) selectDestination(d);
            });
        });
    }

    function initSearch() {
        const input = document.getElementById("destinationInput");
        const suggest = document.getElementById("searchSuggestions");
        input.addEventListener("input", async () => {
            const q = input.value.trim();
            if (q.length < 2) {
                suggest.classList.remove("show");
                suggest.innerHTML = "";
                return;
            }
            const results = await window.SmartTour.services.searchDestinations(q);
            searchResults = Array.isArray(results) ? results : [];
            if (results.length === 0) {
                suggest.innerHTML = `<div class="suggestion-item" style="color:var(--text-muted);">No destinations found for "${q}"</div>`;
            } else {
                suggest.innerHTML = results.map((d) =>
                    `<div class="suggestion-item" data-id="${d.id}">
                        <span class="s-icon">📍</span>
                        <div><strong>${d.name}</strong><br/><span style="color:var(--text-muted);">${d.name}, ${d.country}</span></div>
                    </div>`
                ).join("");
                suggest.querySelectorAll(".suggestion-item:not(.no-result)").forEach((item) => {
                    item.addEventListener("click", () => {
                        const d = searchResults.find((x) => String(x.id) === String(item.dataset.id)) || window.SmartTour.DESTINATIONS.find((x) => String(x.id) === String(item.dataset.id));
                        if (d) selectDestination(d);
                        input.value = d ? d.name : input.value;
                        suggest.classList.remove("show");
                        // Scroll to explore section.
                        document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
                    });
                });
            }
            suggest.classList.add("show");
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".hero-search")) suggest.classList.remove("show");
        });

        const exploreBtn = document.getElementById("exploreBtn");
        exploreBtn.addEventListener("click", async () => {
            const q = input.value.trim();
            if (!q) { showToast("🔍 Please type a destination first."); return; }
            let d = window.SmartTour.DESTINATIONS.find((x) => x.name.toLowerCase() === q.toLowerCase());
            if (!d) {
                try {
                    const matches = await window.SmartTour.services.searchDestinations(q);
                    d = matches && matches[0];
                } catch (e) {
                    d = null;
                }
            }
            if (!d) {
                showToast(`📍 No matching destination found for "${q}".`, "error");
                return;
            }
            input.value = d.name;
            selectDestination(d);
            document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
        });

        const askAiBtn = document.getElementById("askAiBtn");
        if (askAiBtn) {
            askAiBtn.addEventListener("click", () => {
                document.getElementById("assistant").scrollIntoView({ behavior: "smooth" });
                setTimeout(() => document.getElementById("chatInput")?.focus(), 400);
            });
        }
    }

    async function selectDestination(dest) {
        if (!dest) return;
        currentDestination = dest;
        renderDestLoading();
        if (window.SmartTour.mapInstance) {
            window.SmartTour.mapInstance.setDestination(dest);
        }
        try {
            let data = dest;
            if (dest.id && dest.id !== "myloc" && !String(dest.id).startsWith("osm:")) {
                try {
                    data = (await window.SmartTour.services.getDestination(dest.id)) || dest;
                } catch (e) {
                    data = dest;
                }
            }
            currentDestination = data;
            renderDestination(data);
            if (window.SmartTour.mapInstance) window.SmartTour.mapInstance.setDestination(data);
            window.SmartTour.AIChat.setContext(data, null);
            loadWeather(data);
            loadPlaces(data, activeCategory);
        } catch (e) {
            console.error("Destination load failed:", e);
            renderDestError();
        }
    }

    /* ---------- Destination Panel ---------- */
    function renderDestLoading() {
        document.getElementById("destinationPanel").innerHTML = `
            <div class="dest-loading" style="width:100%;">
                <div class="skeleton" style="height:200px;border-radius:16px;"></div>
                <p style="color:var(--text-muted);margin-top:14px;">🌍 Finding your destination...</p>
            </div>`;
    }

    function renderDestination(d) {
        if (!d) {
            renderDestError();
            return;
        }
        const heroPlaces = window.SmartTour.PLACES.filter((p) => Math.abs(p.lat - d.lat) < 0.5);
        const attractions = (d.popularAttractions && d.popularAttractions.length)
            ? d.popularAttractions.join(", ")
            : (heroPlaces.filter((p) => p.category === "Attractions").slice(0, 3).map((p) => p.name).join(", ") || "Nearby attractions are loaded from OpenStreetMap.");
        const bestTime = (d.bestTime && d.bestTime.length) ? d.bestTime.join(", ") : "Check current weather before travelling.";
        const description = d.description || `Explore ${d.name} with Tourez — discover attractions, culture, weather, and essential services in one place.`;
        document.getElementById("destinationPanel").innerHTML = `
            <div class="dest-content">
                <div class="dest-head">
                    <div>
                        <h3 class="dest-title">${d.name}</h3>
                        <div class="dest-country">📍 ${d.name}, ${d.country}</div>
                    </div>
                    <span class="dest-badge">📍 Selected</span>
                </div>
                <p class="dest-desc">${description}</p>
                <div class="dest-about">
                    <div class="dest-about-item"><span class="ic">🏛️</span><div><strong>Popular Attractions</strong><p>${attractions}</p></div></div>
                    <div class="dest-about-item"><span class="ic">🗓️</span><div><strong>Best Time to Visit</strong><p>${bestTime}</p></div></div>
                    <div class="dest-about-item"><span class="ic">🗺️</span><div><strong>Map Data</strong><p>Interactive map powered by Leaflet and OpenStreetMap.</p></div></div>
                </div>
            </div>`;
    }

    function renderDestError() {
        document.getElementById("destinationPanel").innerHTML = `
            <div class="dest-error" style="width:100%;">
                <span style="font-size:2.5rem;">😕</span>
                <p>Couldn't load destination data. Please try again.</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.SmartTour.ui.retryDest()">Retry</button>
            </div>`;
    }

    /* ---------- Weather ---------- */
    function renderWeatherLoading() {
        document.getElementById("weatherCard").innerHTML = `
            <div class="weather-loading">🌦️ Checking current weather...</div>`;
    }

    async function loadWeather(dest) {
        renderWeatherLoading();
        try {
            const w = await window.SmartTour.services.getWeather(dest);
            window.SmartTour.AIChat.setContext(dest, w);
            document.getElementById("weatherCard").innerHTML = `
                <div class="weather-head">
                    <span class="weather-loc">🌦️ ${w.location}</span>
                    <button class="weather-refresh" data-refresh-weather aria-label="Refresh weather">🔄</button>
                </div>
                <div class="weather-main">
                    <span class="weather-icon">${w.icon}</span>
                    <div>
                        <div class="weather-temp">${w.temp}°C</div>
                        <div class="weather-cond">${w.condition}</div>
                        <div class="weather-feels">Feels like ${w.feelsLike}°C</div>
                    </div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail"><div class="w-label">Humidity</div><div class="w-value">${w.humidity}%</div></div>
                    <div class="weather-detail"><div class="w-label">Wind</div><div class="w-value">${w.wind} km/h</div></div>
                    <div class="weather-detail"><div class="w-label">Rain chance</div><div class="w-value">${w.rainChance ?? 0}%</div></div>
                    <div class="weather-detail"><div class="w-label">Updated</div><div class="w-value" style="font-size:0.75rem;">${new Date(w.updatedAt).toLocaleTimeString()}</div></div>
                </div>
                <div class="weather-forecast">
                    ${w.forecast.map((f) => `
                        <div class="forecast-day">
                            <div class="f-day">${f.day}</div>
                            <div class="f-icon">${f.icon}</div>
                            <div class="f-temp">${f.high}° / ${f.low}°</div>
                            ${f.rainChance != null ? `<div class="f-rain">💧 ${f.rainChance}%</div>` : ""}
                        </div>
                    `).join("")}
                </div>
                <div class="weather-source">Forecast: ${w.source || "Live weather"}</div>
            `;
            document.querySelector("[data-refresh-weather]").addEventListener("click", () => loadWeather(dest));
        } catch (e) {
            document.getElementById("weatherCard").innerHTML = `
                <div class="weather-loading" style="color:var(--danger);">
                    ⚠️ Weather service unavailable.<br/>
                    <button class="btn btn-outline btn-sm" style="margin-top:10px;" data-retry-weather>Retry</button>
                </div>`;
            document.querySelector("[data-retry-weather]").addEventListener("click", () => loadWeather(dest));
        }
    }

    /* ---------- Map Filters ---------- */
    function initMapFilters() {
        const wrap = document.getElementById("mapFilters");
        window.SmartTour.CATEGORIES.forEach((c) => {
            const btn = document.createElement("button");
            btn.className = "map-filter-btn";
            btn.textContent = `${c.icon} ${c.category}`;
            btn.dataset.cat = c.category;
            btn.addEventListener("click", () => {
                const wasActive = btn.classList.contains("active");
                document.querySelectorAll(".map-filter-btn").forEach((b) => b.classList.remove("active"));
                if (!wasActive) {
                    btn.classList.add("active");
                    activeCategory = c.category;
                } else {
                    activeCategory = null;
                }
                applyCategory();
            });
            wrap.appendChild(btn);
        });
    }

function applyCategory() {
        if (currentDestination) {
            loadPlaces(currentDestination, activeCategory);
            if (window.SmartTour.mapInstance) window.SmartTour.mapInstance.setActiveCategory(activeCategory);
        }
    }

/* ---------- Map instance helper ---------- */
    function getMap() {
        return window.SmartTour.mapInstance || (window.SmartTour.MapKit ? null : null);
    }

    /* ---------- Places ---------- */
    function renderPlacesLoading() {
        document.getElementById("placesList").innerHTML = `<div class="no-data">📍 Finding nearby places...</div>`;
    }

    async function loadPlaces(dest, category) {
        renderPlacesLoading();
        try {
            const places = await window.SmartTour.services.getNearbyPlaces(dest, category);
            currentPlaces = places;
            if (window.SmartTour.AIChat && window.SmartTour.AIChat.setPlaces) {
                window.SmartTour.AIChat.setPlaces(places);
            }
            renderPlacesToMap(places);
            renderPlacesList(places);
        } catch (e) {
            document.getElementById("placesList").innerHTML = `<div class="no-data">⚠️ Couldn't load places. Try again later.</div>`;
        }
    }

function renderPlacesToMap(places) {
        if (window.SmartTour.mapInstance) {
            window.SmartTour.mapInstance.setPlaces(places);
        }
    }

    function renderPlacesList(places) {
        const wrap = document.getElementById("placesList");
        if (!places.length) {
            wrap.innerHTML = `<div class="no-data">No nearby places in this category were found on OpenStreetMap.</div>`;
            return;
        }
        wrap.innerHTML = places.map((p) => `
            <div class="place-card" data-place-id="${p.id}">
                <div class="place-card-top">
                    <span class="place-card-icon">${iconFor(p.category)}</span>
                    ${p.rating ? `<span class="place-card-rating">⭐ ${p.rating}</span>` : ""}
                </div>
                <div class="place-card-name">${p.name}</div>
                <div class="place-card-cat">${p.category}</div>
                <div class="place-card-meta">📍 ${p.addr || "Address not listed"}${p.distance ? " · " + p.distance : ""}</div>
                <div class="place-card-actions">
                    <button class="btn btn-outline btn-sm" data-card-details data-place-id="${p.id}">Details</button>
                    <button class="btn btn-primary btn-sm" data-card-directions data-place-id="${p.id}">Directions</button>
                </div>
            </div>
        `).join("");
        // Clicking a card focuses the marker on the map.
        wrap.querySelectorAll(".place-card").forEach((card) => {
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
const place = places.find((p) => p.id === card.dataset.placeId);
                if (place && window.SmartTour.mapInstance) {
                    window.SmartTour.mapInstance.openPopup && window.SmartTour.mapInstance.openPopup(place);
                    // Bring marker into view.
                }
            });
        });
        wrap.querySelectorAll("[data-card-details]").forEach((btn) => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const place = places.find((p) => String(p.id) === String(btn.dataset.placeId));
            if (!place) return;
            if (window.SmartTour.mapInstance) window.SmartTour.mapInstance.openPopup(place);
        }));
        wrap.querySelectorAll("[data-card-directions]").forEach((btn) => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const place = places.find((p) => String(p.id) === String(btn.dataset.placeId));
            if (!place) return;
            const url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${encodeURIComponent(place.lat)},${encodeURIComponent(place.lon)}`;
            window.open(url, "_blank", "noopener");
        }));
    }

function iconFor(category) {
        const c = window.SmartTour.CATEGORIES.find((x) => x.category === category);
        return c ? c.icon : "📍";
    }

    /* ---------- Current location ---------- */
    function initLocation() {
        const btn = document.getElementById("useMyLocation");
        btn.addEventListener("click", async () => {
            if (!navigator.geolocation) {
                showToast("📍 Geolocation is not supported by your browser.", "error");
                return;
            }
            showToast("📍 Locating you...");
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const d = { id: "myloc", name: "My Location", country: "Current Area", lat: latitude, lon: longitude };
                    showToast(`✅ Found you! (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
                    selectDestination(d);
                    document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
                },
                (err) => {
                    let msg = "Could not access your location.";
                    if (err.code === 1) msg = "Location permission was denied.";
                    showToast(`📍 ${msg}`, "error");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /* ---------- Leaflet map controls + local place search ---------- */
    function initMapControls() {
        document.querySelectorAll("[data-map-action]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const map = window.SmartTour.mapInstance;
                if (!map) return;
                const action = btn.dataset.mapAction;
                if (action === "zoomIn") map.zoom(1.2);
                if (action === "zoomOut") map.zoom(0.8);
                if (action === "locate") document.getElementById("useMyLocation")?.click();
            });
        });

        const searchInput = document.getElementById("mapSearchInput");
        if (searchInput) {
            searchInput.addEventListener("keydown", (e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const found = window.SmartTour.mapInstance?.search(searchInput.value);
                if (!found) showToast(`🔎 No loaded place matches "${searchInput.value.trim()}".`, "error");
            });
        }
    }

    /* ---------- Reveal on scroll ---------- */
    function initReveal() {
        const els = document.querySelectorAll(".section");
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) e.target.classList.add("reveal-visible");
            });
        }, { threshold: 0.1 });
        els.forEach((el) => {
            el.style.opacity = "0";
            el.style.transform = "translateY(24px)";
            el.style.transition = "opacity .6s ease, transform .6s ease";
            obs.observe(el);
        });
        // Fallback observer.
        const obs2 = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.style.opacity = "1";
                    e.target.style.transform = "translateY(0)";
                }
            });
        }, { threshold: 0.05 });
        document.querySelectorAll(".section").forEach((el) => obs2.observe(el));
    }

    function retryDest() {
        if (currentDestination) selectDestination(currentDestination);
    }

    function init() {
        initTheme();
        initNav();
        initLanguage();
        initSearch();
initMapFilters();
        initLocation();
        initReveal();
        attachChipHandlers();
        // Set default destination.
        const defaultDest = window.SmartTour.DESTINATIONS[0];
        if (defaultDest) selectDestination(defaultDest);
        const year = document.getElementById("year");
        if (year) year.textContent = new Date().getFullYear();
    }

    return { init, showToast, selectDestination, retryDest, openMapPopup: null };
})();

window.SmartTour = window.SmartTour || {};
window.SmartTour.ui = {
    showToast: UI.showToast,
    retryDest: UI.retryDest,
    openMapPopup: function (place) {
        // Delegate to map popup if available.
        if (window.SmartTour.MapKit && place) {
            // MapKit popup handled via onPlaceClick normally.
        }
    },
    selectDestination: UI.selectDestination,
};

window.SmartTour.UI = UI;
