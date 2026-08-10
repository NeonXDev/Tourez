window.SmartTour = window.SmartTour || {};

const MapKit = (function () {
    let map = null;
    let container = null;
    let destination = null;
    let places = [];
    let activeCategory = null;
    let markerLayer = null;
    let destinationMarker = null;
    let markerById = new Map();
    let onPlaceClickCb = null;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function categoryMeta(category) {
        return (window.SmartTour.CATEGORIES || []).find((c) => c.category === category) || {
            category: category || "Place",
            icon: "📍",
            color: "#3b82f6",
        };
    }

    function createPlaceIcon(place) {
        const meta = categoryMeta(place.category);
        return L.divIcon({
            className: "tourez-leaflet-icon",
            html: `<div class="tourez-leaflet-marker" style="--pin-color:${escapeHtml(meta.color)}" title="${escapeHtml(place.name)}"><span>${escapeHtml(meta.icon || place.icon || "📍")}</span></div>`,
            iconSize: [38, 44],
            iconAnchor: [19, 42],
            popupAnchor: [0, -38],
        });
    }

    function popupHtml(place) {
        const meta = categoryMeta(place.category);
        const rating = place.rating ? `<div class="leaflet-place-rating">⭐ ${escapeHtml(place.rating)}</div>` : "";
        const distance = place.distance ? ` · ${escapeHtml(place.distance)}` : "";
        const openText = place.openNow === true ? "Open now" : place.openNow === false ? "Closed now" : "Hours not listed";
        const osmUrl = place.url || `https://www.openstreetmap.org/?mlat=${encodeURIComponent(place.lat)}&mlon=${encodeURIComponent(place.lon)}#map=17/${encodeURIComponent(place.lat)}/${encodeURIComponent(place.lon)}`;
        const directionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${encodeURIComponent(place.lat)},${encodeURIComponent(place.lon)}`;

        return `
            <div class="leaflet-place-popup">
                <div class="place-popup-cat">${escapeHtml(meta.icon || "📍")} ${escapeHtml(place.category || "Place")}</div>
                <div class="place-popup-title">${escapeHtml(place.name)}</div>
                ${rating}
                <div class="place-popup-meta">
                    <div>📍 ${escapeHtml(place.addr || "Location on OpenStreetMap")}${distance}</div>
                    <div>🕐 ${escapeHtml(openText)}</div>
                </div>
                <div class="place-popup-actions">
                    <a class="btn btn-outline btn-sm" href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener">Open in OSM</a>
                    <a class="btn btn-primary btn-sm" href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener">Directions</a>
                </div>
            </div>`;
    }

    function renderDestinationMarker() {
        if (!map) return;
        if (destinationMarker) {
            map.removeLayer(destinationMarker);
            destinationMarker = null;
        }
        if (!destination || !Number.isFinite(+destination.lat) || !Number.isFinite(+destination.lon)) return;

        const icon = L.divIcon({
            className: "tourez-destination-icon",
            html: `<div class="tourez-destination-marker" title="${escapeHtml(destination.name)}">🇳🇵</div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
        });
        destinationMarker = L.marker([+destination.lat, +destination.lon], { icon, keyboard: true })
            .addTo(map)
            .bindTooltip(escapeHtml(destination.name || "Destination"), { direction: "top", offset: [0, -18] });
    }

    function renderMarkers() {
        if (!map || !markerLayer) return;
        markerLayer.clearLayers();
        markerById = new Map();

        const visible = activeCategory
            ? places.filter((p) => p.category === activeCategory)
            : places;

        visible.forEach((place, index) => {
            const lat = +place.lat;
            const lon = +place.lon;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

            const marker = L.marker([lat, lon], {
                icon: createPlaceIcon(place),
                title: place.name || "Place",
                keyboard: true,
            });
            marker.bindPopup(popupHtml(place), { maxWidth: 330, className: "tourez-popup" });
            marker.on("click", () => {
                if (onPlaceClickCb) onPlaceClickCb(place);
            });
            marker.addTo(markerLayer);
            markerById.set(String(place.id ?? index), marker);
        });
    }

    function fitToDestination(dest) {
        if (!map || !dest) return;
        const lat = +dest.lat;
        const lon = +dest.lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        map.setView([lat, lon], 13, { animate: true });
    }

    function openPopup(place) {
        if (!map || !place) return;
        const key = String(place.id ?? "");
        const marker = markerById.get(key);
        if (marker) {
            map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
            marker.openPopup();
            return;
        }
        const lat = +place.lat;
        const lon = +place.lon;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            map.flyTo([lat, lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
            L.popup({ maxWidth: 330, className: "tourez-popup" })
                .setLatLng([lat, lon])
                .setContent(popupHtml(place))
                .openOn(map);
        }
    }

    function searchLoadedPlaces(query) {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return false;
        const match = places.find((p) =>
            [p.name, p.category, p.addr].some((value) => String(value || "").toLowerCase().includes(q))
        );
        if (!match) return false;
        openPopup(match);
        return true;
    }

    function init(containerEl) {
        container = containerEl;
        if (!container) return null;
        if (typeof L === "undefined") {
            container.innerHTML = '<div class="map-load-error">⚠️ Leaflet could not load. Check your internet connection and reload.</div>';
            return null;
        }

        if (map) map.remove();
        container.innerHTML = "";
        map = L.map(container, {
            zoomControl: false,
            attributionControl: true,
            minZoom: 3,
            maxZoom: 19,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        }).addTo(map);

        markerLayer = L.layerGroup().addTo(map);
        const defaultDest = (window.SmartTour.DESTINATIONS || [])[0] || { name: "Nepal", lat: 28.2, lon: 84.0 };
        destination = defaultDest;
        fitToDestination(defaultDest);
        renderDestinationMarker();

        // Leaflet needs an invalidateSize after the page layout settles.
        setTimeout(() => map && map.invalidateSize(), 100);
        window.addEventListener("resize", () => map && map.invalidateSize());

        return instance();
    }

    const instance = () => ({
        setDestination(dest) {
            destination = dest;
            fitToDestination(dest);
            renderDestinationMarker();
            if (map) setTimeout(() => map.invalidateSize(), 50);
        },
        setPlaces(list) {
            places = Array.isArray(list) ? list : [];
            renderMarkers();
        },
        setActiveCategory(category) {
            activeCategory = category || null;
            renderMarkers();
        },
        openPopup,
        closePopup() {
            if (map) map.closePopup();
        },
        getPlaces: () => places,
        getCenter: () => map ? map.getCenter() : null,
        onPlaceClick(cb) {
            onPlaceClickCb = typeof cb === "function" ? cb : null;
        },
        zoom(delta) {
            if (!map) return;
            if (+delta >= 1) map.zoomIn();
            else map.zoomOut();
        },
        locate() {
            if (!map) return;
            map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
        },
        search: searchLoadedPlaces,
        invalidateSize() {
            if (map) map.invalidateSize();
        },
    });

    return { init };
})();

window.SmartTour.MapKit = MapKit;
