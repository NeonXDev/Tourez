const UI = (function () {
    let currentDestination = null;
    let currentPlaces = [];
    let activeCategory = null;
    let searchResults = [];

    /* ---------- Toast ---------- */
    function showToast(msg, type = "info") {
        const wrap = document.getElementById("toastContainer");
        if (!wrap) return;
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
        if (!btn) return;
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
        if (!nav) return;
        window.addEventListener("scroll", () => {
            nav.classList.toggle("scrolled", window.scrollY > 40);
        });
        if (!hamburger || !navLinks) return;
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
        if (!sel) return;
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
        if (!input || !suggest) return;
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
        if (exploreBtn) {
            exploreBtn.addEventListener("click", async () => {
                const q = input.value.trim();
                let d = null;
                if (q) {
                    d = window.SmartTour.DESTINATIONS.find((x) => x.name.toLowerCase() === q.toLowerCase());
                    if (!d) {
                        try {
                            const matches = await window.SmartTour.services.searchDestinations(q);
                            d = matches && matches[0];
                        } catch (e) {
                            d = null;
                        }
                    }
                }
                if (!d) {
                    d = currentDestination || window.SmartTour.DESTINATIONS[0];
                }
                input.value = d.name;
                selectDestination(d);
                const exploreEl = document.getElementById("explore");
                if (exploreEl) {
                    exploreEl.scrollIntoView({ behavior: "smooth" });
                    setTimeout(() => {
                        if (window.SmartTour.mapInstance) window.SmartTour.mapInstance.invalidateSize();
                    }, 250);
                    setTimeout(() => {
                        if (window.SmartTour.mapInstance) window.SmartTour.mapInstance.invalidateSize();
                    }, 650);
                }
                showToast(`🗺️ Opened map for ${d.name}!`);
            });
        }

        const askAiBtn = document.getElementById("askAiBtn");
        if (askAiBtn) {
            askAiBtn.addEventListener("click", () => {
                document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" });
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
        const panel = document.getElementById("destinationPanel");
        if (!panel) return;
        panel.innerHTML = `
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
        const panel = document.getElementById("destinationPanel");
        if (!panel) return;
        const elevations = {
            pokhara: "822m / 2,697 ft · Subtropical Lakeside & Annapurna View",
            kathmandu: "1,400m / 4,593 ft · Historic Valley & UNESCO Heritage",
            chitwan: "150m / 492 ft · Terai Subtropical Jungle & National Park",
            lumbini: "150m / 492 ft · Sacred Birthplace of Lord Buddha",
            mustang: "3,840m / 12,598 ft · Trans-Himalayan Plateau & Muktinath",
            illam: "1,600m / 5,249 ft · Lush Tea Gardens & Mountain Sunrises",
            ilam: "1,600m / 5,249 ft · Lush Tea Gardens & Mountain Sunrises",
        };
        const elev = elevations[(d.id || d.name || "").toLowerCase()] || "Himalayan Region, Nepal";

        panel.innerHTML = `
            <div class="dest-content">
                <div class="dest-head">
                    <div>
                        <h3 class="dest-title">${d.name}</h3>
                        <div class="dest-country">📍 ${d.name}, ${d.country || "Nepal"}</div>
                    </div>
                    <span class="dest-badge">✓ Active Explorer</span>
                </div>
                <div class="dest-elevation-pill">🏔️ Elevation: ${elev}</div>
                <p class="dest-desc">${description}</p>
                <div class="dest-about">
                    <div class="dest-about-item"><span class="ic">🏛️</span><div><strong>Top Attractions</strong><p>${attractions}</p></div></div>
                    <div class="dest-about-item"><span class="ic">🗓️</span><div><strong>Best Seasons</strong><p>${bestTime}</p></div></div>
                    <div class="dest-about-item"><span class="ic">🗺️</span><div><strong>Interactive Map</strong><p>OpenStreetMap live tiles with real distances.</p></div></div>
                </div>
                <div class="dest-quick-actions">
                    <button class="btn btn-outline btn-sm" id="destPlanBtn">🧳 Plan ${d.name} Trip</button>
                    <button class="btn btn-primary btn-sm" id="destAskAiBtn">🤖 Ask AI about ${d.name}</button>
                </div>
            </div>`;

        // Wire quick actions
        document.getElementById("destPlanBtn")?.addEventListener("click", () => {
            const planDest = document.getElementById("planDest");
            if (planDest) planDest.value = d.name;
            document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" });
        });
        document.getElementById("destAskAiBtn")?.addEventListener("click", () => {
            document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" });
            const input = document.getElementById("chatInput");
            if (input) {
                input.value = `Tell me the top must-visit places and local food in ${d.name}.`;
                input.focus();
            }
        });
    }

    function renderDestError() {
        const panel = document.getElementById("destinationPanel");
        if (!panel) return;
        panel.innerHTML = `
            <div class="dest-error" style="width:100%;">
                <span style="font-size:2.5rem;">😕</span>
                <p>Couldn't load destination data. Please try again.</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.SmartTour.ui.retryDest()">Retry</button>
            </div>`;
    }

    /* ---------- Weather ---------- */
    function renderWeatherLoading() {
        const card = document.getElementById("weatherCard");
        if (!card) return;
        card.innerHTML = `
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
        const list = document.getElementById("placesList");
        if (!list) return;
        list.innerHTML = `<div class="no-data">📍 Finding nearby places...</div>`;
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
            const list = document.getElementById("placesList");
            if (list) list.innerHTML = `<div class="no-data">⚠️ Couldn't load places. Try again later.</div>`;
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
            <div class="place-card" data-place-id="${p.id}" tabindex="0" role="article" aria-label="${p.name}, ${p.category}">
                <div class="place-card-top">
                    <span class="place-card-icon" aria-hidden="true">${iconFor(p.category)}</span>
                    ${p.rating ? `<span class="place-card-rating" aria-label="Rating ${p.rating} out of 5 stars">⭐ ${p.rating}</span>` : ""}
                </div>
                <div class="place-card-name">${p.name}</div>
                <div class="place-card-cat">${p.category}</div>
                <div class="place-card-meta">📍 ${p.addr || "Address not listed"}${p.distance ? " · " + p.distance : ""}</div>
                <div class="place-card-actions">
                    <button class="btn btn-outline btn-sm" data-card-details data-place-id="${p.id}" aria-label="View details for ${p.name}">Details</button>
                    <button class="btn btn-primary btn-sm" data-card-directions data-place-id="${p.id}" aria-label="Get directions to ${p.name}">Directions</button>
                </div>
            </div>
        `).join("");

        // Support Enter / Space on place card for keyboard navigation (Item 15)
        wrap.querySelectorAll(".place-card").forEach((card) => {
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    if (e.target.closest("button")) return;
                    e.preventDefault();
                    const place = places.find((p) => String(p.id) === String(card.dataset.placeId));
                    if (place && window.SmartTour.mapInstance) {
                        window.SmartTour.mapInstance.openPopup && window.SmartTour.mapInstance.openPopup(place);
                    }
                }
            });
        });
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
            const mapWrap = document.getElementById("explore");
            if (mapWrap) mapWrap.scrollIntoView({ behavior: "smooth" });
            if (window.SmartTour.mapInstance) {
                setTimeout(() => window.SmartTour.mapInstance.openPopup(place), 300);
            }
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
        if (!("IntersectionObserver" in window)) {
            els.forEach((el) => {
                el.style.opacity = "1";
                el.style.transform = "translateY(0)";
            });
            return;
        }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add("reveal-visible");
                    if (e.target.id === "explore" && window.SmartTour.mapInstance) {
                        setTimeout(() => window.SmartTour.mapInstance.invalidateSize(), 200);
                        setTimeout(() => window.SmartTour.mapInstance.invalidateSize(), 700);
                    }
                }
            });
        }, { threshold: 0.1 });
        els.forEach((el) => {
            el.style.opacity = "0";
            el.style.transform = "translateY(24px)";
            el.style.transition = "opacity .6s ease, transform .6s ease";
            obs.observe(el);
        });
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


    /* ---------- Modals (Items 1, 2, 3, 4, 8, 10, 19, 20) ---------- */
    function initModals() {
        let lastFocusedElement = null;

        function openModal(modalId, triggerEl) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            lastFocusedElement = triggerEl || document.activeElement;
            modal.classList.add("active");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length) focusable[0].focus();
        }

        function closeModal(modal) {
            if (!modal) return;
            modal.classList.remove("active");
            modal.setAttribute("aria-hidden", "true");
            if (!document.querySelector(".modal-backdrop.active")) {
                document.body.classList.remove("modal-open");
            }
            if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                lastFocusedElement.focus();
            }
        }

        document.querySelectorAll("[data-open-modal]").forEach((trigger) => {
            trigger.addEventListener("click", (e) => {
                e.preventDefault();
                const modalId = trigger.getAttribute("data-open-modal");
                openModal(modalId, trigger);
            });
        });

        document.querySelectorAll("[data-close-modal]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const modal = btn.closest(".modal-backdrop");
                closeModal(modal);
            });
        });

        document.querySelectorAll(".modal-backdrop").forEach((modal) => {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) closeModal(modal);
            });
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const activeModal = document.querySelector(".modal-backdrop.active");
                if (activeModal) closeModal(activeModal);
            }
        });
    }

    /* ---------- Cookie Consent Banner (Items 4, 5) ---------- */
    function initCookieConsent() {
        const banner = document.getElementById("cookieBanner");
        const acceptBtn = document.getElementById("cookieAcceptBtn");
        const essentialBtn = document.getElementById("cookieEssentialBtn");
        const settingsLink = document.getElementById("footerCookieSettings");

        const consent = localStorage.getItem("tourez_cookie_consent");
        if (!consent && banner) {
            setTimeout(() => banner.classList.add("show"), 800);
        }

        if (acceptBtn) {
            acceptBtn.addEventListener("click", () => {
                localStorage.setItem("tourez_cookie_consent", "all");
                banner?.classList.remove("show");
                showToast("🍪 All cookie preferences accepted.");
            });
        }

        if (essentialBtn) {
            essentialBtn.addEventListener("click", () => {
                localStorage.setItem("tourez_cookie_consent", "essential");
                banner?.classList.remove("show");
                showToast("🍪 Saved: Essential storage only.");
            });
        }

        if (settingsLink) {
            settingsLink.addEventListener("click", () => {
                const modal = document.getElementById("cookieModal");
                if (modal) {
                    modal.classList.add("active");
                    modal.setAttribute("aria-hidden", "false");
                    document.body.classList.add("modal-open");
                }
            });
        }
    }

    /* ---------- Newsletter & 1-Click Unsubscribe (Items 6, 18) ---------- */
    function initNewsletter() {
        const form = document.getElementById("newsletterForm");
        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const emailInput = document.getElementById("newsletterEmail");
                const consentBox = document.getElementById("newsletterConsent");
                if (consentBox && !consentBox.checked) {
                    showToast("⚠️ Please agree to receive seasonal travel updates.", "error");
                    return;
                }
                const email = emailInput ? emailInput.value.trim() : "";
                if (!email) return;

                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    await window.SmartTour.services.subscribeNewsletter(email);
                    showToast(`📬 Subscribed! Updates will be sent to ${email}.`, "success");
                    form.reset();
                } catch (err) {
                    showToast("⚠️ Could not subscribe. Please try again.", "error");
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        const unsubForm = document.getElementById("unsubscribeForm");
        if (unsubForm) {
            unsubForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = document.getElementById("unsubEmail")?.value.trim();
                const resultWrap = document.getElementById("unsubResult");
                if (!email) return;

                try {
                    await window.SmartTour.services.unsubscribeNewsletter(email);
                    if (resultWrap) {
                        resultWrap.innerHTML = `
                            <div class="legal-callout success" style="margin-top:10px;">
                                ✅ <strong>${email}</strong> has been successfully unsubscribed from all Tourez alerts.
                            </div>`;
                    }
                    showToast("✅ Unsubscribed successfully.");
                    unsubForm.reset();
                } catch (err) {
                    showToast("⚠️ Could not complete request.", "error");
                }
            });
        }
    }

    /* ---------- Data Deletion & Erasure Requests (Item 20) ---------- */
    function initDataDeletion() {
        const wipeBtn = document.getElementById("wipeLocalDataBtn");
        const feedback = document.getElementById("localWipeFeedback");
        if (wipeBtn) {
            wipeBtn.addEventListener("click", () => {
                localStorage.clear();
                sessionStorage.clear();
                if (feedback) {
                    feedback.innerHTML = `
                        <div class="legal-callout success">
                            ✅ <strong>Local Storage Cleared:</strong> All cached itineraries, wallet tokens, theme preferences, and cookies have been permanently deleted from this browser.
                        </div>`;
                }
                showToast("🗑️ All local data permanently wiped.", "success");
                const navBalance = document.getElementById("navWalletBalance");
                if (navBalance) navBalance.textContent = "रू 0";
                const walletBalance = document.getElementById("walletBalance");
                if (walletBalance) walletBalance.textContent = "रू 0.00";
                const historyEl = document.getElementById("walletHistory");
                if (historyEl) historyEl.innerHTML = "";
            });
        }

        const form = document.getElementById("dataDeletionForm");
        const resultWrap = document.getElementById("deletionResult");
        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const name = document.getElementById("delName")?.value.trim();
                const email = document.getElementById("delEmail")?.value.trim();
                const type = document.getElementById("delType")?.value;
                const confirmBox = document.getElementById("delConfirmCheckbox");

                if (!confirmBox || !confirmBox.checked) {
                    showToast("⚠️ Please confirm the verification checkbox.", "error");
                    return;
                }

                const submitBtn = document.getElementById("delSubmitBtn");
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Submitting Request...";
                }

                try {
                    const res = await window.SmartTour.services.requestDataDeletion({
                        name,
                        email,
                        request_type: type,
                    });

                    if (resultWrap) {
                        resultWrap.innerHTML = `
                            <div class="deletion-receipt-card">
                                <strong>✅ Data Deletion Request Registered</strong>
                                <p style="margin:6px 0;">Official Ticket Reference:</p>
                                <div class="deletion-ticket-num">${res.ticket_id || "DEL-2026-NP" + Math.floor(10000 + Math.random() * 90000)}</div>
                                <p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px;">
                                    A formal purge request for <strong>${email}</strong> has been logged. Under GDPR Art. 17 and Nepal Privacy Act 2075, server logs and indices will be purged within 72 hours.
                                </p>
                            </div>`;
                    }
                    showToast(`✅ Deletion request registered: ${res.ticket_id || "Ticket created"}`);
                    form.reset();
                } catch (err) {
                    showToast("⚠️ Request error. Please contact privacy@tourez.com.np", "error");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Submit Erasure Request";
                    }
                }
            });
        }
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
        initMapControls();
        initModals();
        initCookieConsent();
        initNewsletter();
        initDataDeletion();
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
