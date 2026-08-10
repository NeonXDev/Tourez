const AIChat = (function () {
    const prompts = [
        "Plan my trip",
        "What should I visit?",
        "Tell me about the culture",
        "What food should I try?",
        "What's the weather?",
        "Find nearby restaurants",
        "Find ATMs",
        "Where can I exchange money?",
        "What should I avoid?",
    ];

    let context = { destination: null, weather: null, places: [] };
    let chatHistory = [];

    function setContext(dest, weather) {
        const oldKey = context.destination ? `${context.destination.id || ""}:${context.destination.name || ""}` : "";
        const newKey = dest ? `${dest.id || ""}:${dest.name || ""}` : "";
        const destinationChanged = Boolean(oldKey && newKey && oldKey !== newKey);
        context = {
            ...context,
            destination: dest,
            weather: destinationChanged ? (weather || null) : (weather ?? context.weather),
            places: destinationChanged ? [] : context.places,
        };
        const badge = document.getElementById("aiContextBadge");
        if (badge && dest) {
            badge.innerHTML = `📍 Exploring <strong>${dest.name}, ${dest.country}</strong>`;
        }
        const status = document.getElementById("aiStatus");
        if (status && dest) status.textContent = `📍 Online · ${dest.name}`;
    }

    function setPlaces(places) {
        const incoming = Array.isArray(places) ? places : [];
        const merged = [...(context.places || [])];
        const seen = new Set(merged.map((p) => String(p.id || `${p.name}:${p.lat}:${p.lon}`)));
        incoming.forEach((p) => {
            const key = String(p.id || `${p.name}:${p.lat}:${p.lon}`);
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(p);
            }
        });
        context = { ...context, places: merged.slice(-60) };
    }

    function renderPrompts() {
        const wrap = document.getElementById("suggestedPrompts");
        if (!wrap) return;
        wrap.innerHTML = "";
        prompts.forEach((p) => {
            const btn = document.createElement("button");
            btn.className = "prompt-btn";
            btn.textContent = p;
            btn.addEventListener("click", () => sendMessage(p));
            wrap.appendChild(btn);
        });
    }

    function addTyping() {
        const msgs = document.getElementById("chatMessages");
        const div = document.createElement("div");
        div.className = "chat-msg ai";
        div.id = "typingMsg";
        div.innerHTML = `
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble"><span class="typing-indicator"><span></span><span></span><span></span></span></div>
        `;
        msgs.appendChild(div);
        scrollChat();
    }

    function removeTyping() {
        const t = document.getElementById("typingMsg");
        if (t) t.remove();
    }

    function scrollChat() {
        const msgs = document.getElementById("chatMessages");
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function addMessage(text, sender) {
        const msgs = document.getElementById("chatMessages");
        const div = document.createElement("div");
        div.className = `chat-msg ${sender}`;
        const avatar = sender === "user" ? "🧑" : "🤖";
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const escaped = String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        const formatted = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
        div.innerHTML = `
            <div class="msg-avatar">${avatar}</div>
            <div>
                <div class="msg-bubble">${formatted}</div>
                <div class="msg-time">${time}</div>
            </div>
        `;
        msgs.appendChild(div);
        scrollChat();
    }

    async function sendMessage(text) {
        const input = document.getElementById("chatInput");
        if (!text || !text.trim()) return;
        const message = text.trim();
        addMessage(message, "user");
        input.value = "";
        addTyping();
        try {
            const response = await window.SmartTour.services.sendAIMessage(message, context, chatHistory);
            removeTyping();
            const reply = response.message || response;
            addMessage(reply, "ai");
            chatHistory.push({ role: "user", content: message }, { role: "assistant", content: String(reply) });
            chatHistory = chatHistory.slice(-8);
        } catch (err) {
            removeTyping();
            addMessage("⚠️ Sorry, I couldn't reach the AI service. Please try again. (FastAPI / AI service unavailable)", "ai");
        }
    }

    function bindChat() {
        const input = document.getElementById("chatInput");
        const sendBtn = document.getElementById("sendBtn");
        const clearBtn = document.getElementById("clearChat");
        sendBtn.addEventListener("click", () => sendMessage(input.value));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sendMessage(input.value);
            }
        });
clearBtn.addEventListener("click", () => {
            chatHistory = [];
            document.getElementById("chatMessages").innerHTML = "";
            addMessage("👋 Hello! I'm your Tourez AI assistant. Ask me anything about your destination — culture, food, weather, places, or trip planning.", "ai");
        });
    }

    /* ---------- Trip Planner ---------- */
    function collectInterests() {
        return [...document.querySelectorAll("#interestChips .toggle.active")].map((b) => b.dataset.interest);
    }

    function bindPlanner() {
        const chips = document.querySelectorAll("#interestChips .toggle");
        chips.forEach((c) => c.addEventListener("click", () => c.classList.toggle("active")));

        document.getElementById("planTripBtn").addEventListener("click", async () => {
            const destName = document.getElementById("planDest").value.trim() || "Pokhara";
            const dest = (window.SmartTour.DESTINATIONS || []).find((d) => d.name.toLowerCase() === destName.toLowerCase()) ||
                { name: destName, country: "", lat: 28.2096, lon: 83.9856 };
            const prefs = {
                destination: dest.name,
                duration: +document.getElementById("planDuration").value || 3,
                travelers: +document.getElementById("planTravelers").value || 2,
                budget: +document.getElementById("planBudget").value || 300,
                currency: document.getElementById("planCurrency").value,
                interests: collectInterests(),
            };
            const panel = document.getElementById("itineraryPanel");
            panel.innerHTML = `<div class="itinerary-loading"><span class="empty-icon">🧳</span><p>Creating your personalized itinerary...</p></div>`;
            try {
                const plan = await window.SmartTour.services.planTrip(prefs);
                panel.innerHTML = renderItinerary(plan);
                bindItineraryActions(plan);
            } catch (e) {
                panel.innerHTML = `<div class="itinerary-error">⚠️ Could not create your itinerary. Please try again.</div>`;
            }
        });
    }

    function renderItinerary(plan) {
        const daysHtml = plan.days.map((d) => `
            <div class="itin-day">
                <div class="itin-day-head">
                    <span>Day ${d.day}</span>
                    <span class="itin-day-theme">${d.theme}</span>
                </div>
                <div class="itin-day-body">
                    ${d.activities.map((a) => `
                        <div class="itin-activity">
                            <span class="itin-time">${a.time}</span>
                            <div class="itin-detail">
                                <strong>${a.place}</strong>
                                <p>${a.detail}</p>
                                <p style="color:var(--text-soft);font-size:0.8rem;">🚌 ${a.transport}</p>
                                <div class="itin-cost">💰 est. ${a.cost} ${plan.currency}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");

        return `
            <div class="itin-summary">
                <div class="it"><span class="k">Destination</span><span class="v">${plan.destination}</span></div>
                <div class="it"><span class="k">Duration</span><span class="v">${plan.duration} days</span></div>
                <div class="it"><span class="k">Travelers</span><span class="v">${plan.travelers}</span></div>
                <div class="it"><span class="k">Budget</span><span class="v">${plan.budget} ${plan.currency}</span></div>
                <div class="it"><span class="k">Total Cost</span><span class="v">${plan.totalCost} ${plan.currency}</span></div>
                <div class="it"><span class="k">Remaining</span><span class="v" style="color:var(--success);">${plan.remaining} ${plan.currency}</span></div>
            </div>
            ${daysHtml}
            ${plan.note ? `<p style="color:var(--text-soft);font-size:0.82rem;margin-top:10px;">ℹ️ ${plan.note}</p>` : ""}
            <div class="itin-modify-bar">
                <button class="btn btn-primary" id="modifyRainBtn">🌧️ "It's going to rain tomorrow. Change Day 2."</button>
            </div>
        `;
    }

    function bindItineraryActions(plan) {
        const modifyBtn = document.getElementById("modifyRainBtn");
        if (!modifyBtn) return;
        modifyBtn.addEventListener("click", async () => {
            modifyBtn.disabled = true;
            modifyBtn.textContent = "🤖 Adapting itinerary to weather...";
            const panel = document.getElementById("itineraryPanel");
            try {
                const weatherDest = (window.SmartTour.DESTINATIONS || []).find(
                    (d) => d.name.toLowerCase() === String(plan.destination || "").toLowerCase()
                ) || context.destination;
                const weather = context.weather || (weatherDest ? await window.SmartTour.services.getWeather(weatherDest) : null);
                const updated = await window.SmartTour.services.modifyItinerary(plan, weather, "It's going to rain tomorrow. Change Day 2.");
                panel.innerHTML = renderItinerary(updated);
                window.SmartTour.ui && window.SmartTour.ui.showToast("🌧️ Itinerary adapted based on weather!");
                bindItineraryActions(updated);
            } catch (e) {
                window.SmartTour.ui && window.SmartTour.ui.showToast("⚠️ Could not adapt itinerary.", "error");
                modifyBtn.disabled = false;
                modifyBtn.textContent = '🌧️ "It\'s going to rain tomorrow. Change Day 2."';
            }
        });
    }

function init() {
        renderPrompts();
        bindChat();
        bindPlanner();
        addMessage("👋 Hello! I'm your Tourez AI assistant. Ask me anything about your destination — culture, food, weather, places, or trip planning.", "ai");
    }

    return { init, setContext, setPlaces };
})();

window.SmartTour = window.SmartTour || {};
window.SmartTour.AIChat = AIChat;
