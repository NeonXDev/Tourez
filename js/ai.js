const AIChat = (function () {
    const DEST_PROMPTS = {
        pokhara: [
            "Best sunset viewpoints in Pokhara",
            "Phewa Lake boating & Peace Pagoda hike",
            "Top Thakali thali spots in Lakeside",
            "Sarangkot paragliding tips & weather",
            "Quiet cafes with mountain views",
        ],
        kathmandu: [
            "Kathmandu 2-day heritage walking tour",
            "Boudhanath stupa evening prayers & cafes",
            "Patan Durbar Square museum highlights",
            "Authentic Newari street food in Thamel",
            "Swayambhunath monkeys etiquette",
        ],
        chitwan: [
            "Jeep safari vs walking safari in Chitwan",
            "Best season to spot one-horned rhinos",
            "Tharu cultural village tour & dance",
            "Jungle safari packing checklist",
        ],
        mustang: [
            "Muktinath temple pilgrimage guide",
            "Jomsom flight vs overland jeep",
            "Local Marpha apple cider & culture",
            "Altitude sickness precautions in Mustang",
        ],
        lumbini: [
            "Maya Devi temple sacred garden guide",
            "Bicycle tour across international monasteries",
            "Peace Pagoda meditation timings",
        ],
        ilam: [
            "Kanyam tea garden photo viewpoints",
            "Shree Antu sunrise viewing guide",
            "Traditional organic orthodox tea tasting",
        ],
        illam: [
            "Kanyam tea garden photo viewpoints",
            "Shree Antu sunrise viewing guide",
            "Traditional organic orthodox tea tasting",
        ],
    };
    const defaultPrompts = [
        "Plan my Nepal itinerary",
        "What food should I try?",
        "What are the trekking permit rules?",
        "Where can I exchange money safely?",
        "What cultural etiquette should I follow?",
    ];
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
            badge.innerHTML = `📍 Exploring <strong>${dest.name}, ${dest.country || "Nepal"}</strong>`;
        }
        const status = document.getElementById("aiStatus");
        if (status && dest) status.textContent = `📍 Online · ${dest.name}`;

        // Keep AI Trip Planner destination in sync with selected destination
        const planDest = document.getElementById("planDest");
        if (planDest && dest && dest.name) {
            planDest.value = dest.name;
        }
        renderPrompts();
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
        const destKey = ((context.destination && (context.destination.id || context.destination.name)) || "pokhara").toLowerCase();
        const activePrompts = DEST_PROMPTS[destKey] || defaultPrompts;
        activePrompts.forEach((p) => {
            const btn = document.createElement("button");
            btn.className = "prompt-btn";
            btn.textContent = p;
            btn.addEventListener("click", () => sendMessage(p));
            wrap.appendChild(btn);
        });
    }

    function addTyping() {
        const msgs = document.getElementById("chatMessages");
        if (!msgs) return;
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
        if (!msgs) return;
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
        let formatted = escaped
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/^\s*[-*]\s+(.*?)$/gm, "<li>$1</li>");
        if (formatted.includes("<li>")) {
            formatted = formatted.replace(/(<li>.*?<\/li>)/s, "<ul>$1</ul>");
        }
        formatted = formatted.replace(/\n/g, "<br/>");

        const copyBtnHtml = sender === "ai" ? `<button class="msg-copy-btn" title="Copy recommendation">📋 Copy</button>` : "";

        div.innerHTML = `
            <div class="msg-avatar">${avatar}</div>
            <div>
                <div class="msg-bubble">${formatted}</div>
                <div class="msg-footer-row">
                    <span class="msg-time">${time}</span>
                    ${copyBtnHtml}
                </div>
            </div>
        `;

        if (sender === "ai") {
            const copyBtn = div.querySelector(".msg-copy-btn");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    navigator.clipboard.writeText(text);
                    copyBtn.textContent = "✓ Copied!";
                    setTimeout(() => copyBtn.textContent = "📋 Copy", 2000);
                });
            }
        }
        msgs.appendChild(div);
        scrollChat();
    }

    async function sendMessage(text) {
        const input = document.getElementById("chatInput");
        if (!text || !text.trim()) return;
        const message = text.trim();
        addMessage(message, "user");
        if (input) input.value = "";
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
            addMessage("⚠️ Sorry, I couldn't reach the AI service right now. Please try again.", "ai");
        }
    }

    function bindChat() {
        const input = document.getElementById("chatInput");
        const sendBtn = document.getElementById("sendBtn");
        const clearBtn = document.getElementById("clearChat");
        if (sendBtn && input) {
            sendBtn.addEventListener("click", () => sendMessage(input.value));
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage(input.value);
                }
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                chatHistory = [];
                const msgs = document.getElementById("chatMessages");
                if (msgs) msgs.innerHTML = "";
                addMessage("👋 Hello! I'm your Tourez AI assistant. Ask me anything about your destination — culture, food, weather, places, or trip planning.", "ai");
            });
        }
    }

    /* ---------- Trip Planner ---------- */
    function collectInterests() {
        return [...document.querySelectorAll("#interestChips .toggle.active")].map((b) => b.dataset.interest);
    }

    function bindPlanner() {
        const chips = document.querySelectorAll("#interestChips .toggle");
        chips.forEach((c) => c.addEventListener("click", () => c.classList.toggle("active")));

        const curSelect = document.getElementById("planCurrency");
        const budgetInput = document.getElementById("planBudget");
        if (curSelect && budgetInput) {
            curSelect.addEventListener("change", () => {
                const c = curSelect.value;
                const curVal = +budgetInput.value;
                if (c === "NPR" && curVal < 2000) {
                    budgetInput.value = 40000;
                } else if (c === "INR" && curVal < 1500) {
                    budgetInput.value = 25000;
                } else if (c === "JPY" && curVal < 2000) {
                    budgetInput.value = 45000;
                } else if ((c === "USD" || c === "EUR" || c === "GBP") && curVal > 5000) {
                    budgetInput.value = 300;
                }
            });
        }

        const planBtn = document.getElementById("planTripBtn");
        if (!planBtn) return;

        const triggerPlan = async () => {
            const consentCheckbox = document.getElementById("plannerConsent");
            if (consentCheckbox && !consentCheckbox.checked) {
                consentCheckbox.focus();
                consentCheckbox.closest(".planner-consent-row")?.classList.add("consent-highlight");
                setTimeout(() => consentCheckbox.closest(".planner-consent-row")?.classList.remove("consent-highlight"), 2500);
                window.SmartTour.ui && window.SmartTour.ui.showToast("⚠️ Please accept the Terms & Privacy Policy (confirming 16+ age) to proceed.", "error");
                return;
            }

            const destInput = document.getElementById("planDest");
            const destName = (destInput ? destInput.value.trim() : "") || (context.destination && context.destination.name) || "Pokhara";
            const dest = (window.SmartTour.DESTINATIONS || []).find((d) => d.name.toLowerCase() === destName.toLowerCase()) ||
                context.destination || { name: destName, country: "Nepal", lat: 28.2096, lon: 83.9856 };

            const durationInput = document.getElementById("planDuration");
            const travelersInput = document.getElementById("planTravelers");
            const currencySelect = document.getElementById("planCurrency");

            const prefs = {
                destination: dest.name || destName,
                duration: Math.max(1, Math.min(14, +(durationInput ? durationInput.value : 3) || 3)),
                travelers: Math.max(1, +(travelersInput ? travelersInput.value : 2) || 2),
                budget: Math.max(0, +(budgetInput ? budgetInput.value : 300) || 300),
                currency: currencySelect ? currencySelect.value : "USD",
                interests: collectInterests(),
                lat: dest.lat,
                lon: dest.lon,
            };

            const panel = document.getElementById("itineraryPanel");
            if (!panel) return;

            planBtn.disabled = true;
            const originalBtnText = planBtn.innerHTML;
            planBtn.innerHTML = `⏳ Crafting Your Itinerary...`;
            panel.innerHTML = `<div class="itinerary-loading"><span class="empty-icon">🧳</span><p>Creating your personalized itinerary for ${prefs.destination}...</p></div>`;

            try {
                const plan = await window.SmartTour.services.planTrip(prefs);
                panel.innerHTML = renderItinerary(plan);
                bindItineraryActions(plan);
                window.SmartTour.ui && window.SmartTour.ui.showToast(`✨ Itinerary created for ${plan.destination}!`);
            } catch (e) {
                console.error("Trip planning failed:", e);
                panel.innerHTML = `<div class="itinerary-error">⚠️ Could not create your itinerary. Please check your preferences and try again.</div>`;
            } finally {
                planBtn.disabled = false;
                planBtn.innerHTML = originalBtnText;
            }
        };

        planBtn.addEventListener("click", triggerPlan);

        // Allow pressing Enter in planner inputs
        ["planDest", "planDuration", "planTravelers", "planBudget"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        triggerPlan();
                    }
                });
            }
        });
    }

    function renderItinerary(plan) {
        if (!plan) return `<div class="itinerary-error">⚠️ No itinerary data available.</div>`;
        const days = Array.isArray(plan.days) ? plan.days : [];
        const currency = plan.currency || "USD";
        const totalCost = plan.totalCost ?? plan.total_cost ?? 0;
        const budget = plan.budget ?? 0;
        const remaining = plan.remaining ?? Math.max(0, budget - totalCost);
        const isOverBudget = remaining <= 0 && totalCost > budget;

        const daysHtml = days.map((d) => `
            <div class="itin-day">
                <div class="itin-day-head">
                    <span>Day ${d.day}</span>
                    <span class="itin-day-theme">${d.theme || "Exploration"}</span>
                </div>
                <div class="itin-day-body">
                    ${(d.activities || []).map((a) => `
                        <div class="itin-activity">
                            <span class="itin-time">${a.time || "09:00"}</span>
                            <div class="itin-detail">
                                <strong>${a.place || "Local sight"}</strong>
                                <p>${a.detail || ""}</p>
                                <p style="color:var(--text-soft);font-size:0.8rem;">🚌 ${a.transport || "Local transport"}</p>
                                <div class="itin-cost">💰 est. ${a.cost || 0} ${currency}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");

        const modifiedHtml = plan.modified ? `
            <div class="itin-modified-badge">
                <span>✨</span>
                <div><strong>AI Update:</strong> ${plan.modified}</div>
            </div>
        ` : "";

        const hasMultipleDays = days.length > 1;
        const targetRainDay = hasMultipleDays ? "Day 2" : "Day 1";

        return `
            ${modifiedHtml}
            <div class="itin-summary">
                <div class="it"><span class="k">Destination</span><span class="v">📍 ${plan.destination}</span></div>
                <div class="it"><span class="k">Duration</span><span class="v">🗓️ ${plan.duration} days</span></div>
                <div class="it"><span class="k">Travelers</span><span class="v">👥 ${plan.travelers}</span></div>
                <div class="it"><span class="k">Budget</span><span class="v">💵 ${Number(budget).toLocaleString()} ${currency}</span></div>
                <div class="it"><span class="k">Total Cost</span><span class="v">💰 ${Number(totalCost).toLocaleString()} ${currency}</span></div>
                <div class="it"><span class="k">${isOverBudget ? "Over Budget" : "Remaining"}</span><span class="v" style="color:${isOverBudget ? "var(--danger, #ef4444)" : "var(--success, #10b981)"};">${Number(remaining).toLocaleString()} ${currency}</span></div>
            </div>
            <div class="itin-budget-bar-wrap">
                <div class="itin-budget-bar-labels">
                    <span>Budget Meter (${Math.round(budget > 0 ? (totalCost / budget) * 100 : 0)}% allocated)</span>
                    <strong>${Number(totalCost).toLocaleString()} / ${Number(budget).toLocaleString()} ${currency}</strong>
                </div>
                <div class="itin-budget-bar">
                    <div class="itin-budget-fill ${isOverBudget ? 'over' : ''}" style="width: ${Math.min(100, Math.round(budget > 0 ? (totalCost / budget) * 100 : 0))}%"></div>
                </div>
            </div>
            ${daysHtml}
            ${plan.note ? `<p style="color:var(--text-soft);font-size:0.82rem;margin-top:12px;">ℹ️ ${plan.note}</p>` : ""}
            <div class="itin-modify-bar">
                <button class="btn btn-primary" id="modifyRainBtn">🌧️ "Rain forecast: Adapt ${targetRainDay} to indoor activities"</button>
                <button class="btn btn-outline" id="modifyOutdoorBtn">☀️ "Focus on scenic outdoor viewpoints"</button>
                <button class="btn btn-outline" id="printItinBtn">🖨️ Print Itinerary</button>
            </div>
            <div class="itin-custom-modify">
                <input type="text" id="customModifyInput" placeholder="Ask AI to adapt (e.g. 'more photography spots', 'budget under 200', 'family-friendly')..." />
                <button class="btn btn-outline" id="customModifyBtn">⚡ Update</button>
            </div>
        `;
    }

    function bindItineraryActions(plan) {
        async function runModify(instruction, btnEl, btnLoadingText) {
            if (btnEl) {
                btnEl.disabled = true;
                if (btnLoadingText) btnEl.textContent = btnLoadingText;
            }
            const panel = document.getElementById("itineraryPanel");
            try {
                const weatherDest = (window.SmartTour.DESTINATIONS || []).find(
                    (d) => d.name.toLowerCase() === String(plan.destination || "").toLowerCase()
                ) || context.destination;
                const weather = context.weather || (weatherDest ? await window.SmartTour.services.getWeather(weatherDest) : null);
                const updated = await window.SmartTour.services.modifyItinerary(plan, weather, instruction);
                panel.innerHTML = renderItinerary(updated);
                window.SmartTour.ui && window.SmartTour.ui.showToast("✨ Itinerary updated by Tourez AI!");
                bindItineraryActions(updated);
            } catch (e) {
                console.error("Modify error:", e);
                window.SmartTour.ui && window.SmartTour.ui.showToast("⚠️ Could not modify itinerary.", "error");
                if (btnEl) btnEl.disabled = false;
            }
        }

        const modifyRainBtn = document.getElementById("modifyRainBtn");
        if (modifyRainBtn) {
            modifyRainBtn.addEventListener("click", () => {
                const dayNum = (plan.days && plan.days.length > 1) ? "Day 2" : "Day 1";
                runModify(`It's going to rain tomorrow. Change ${dayNum} to indoor cultural activities.`, modifyRainBtn, "🤖 Adapting for rain...");
            });
        }

        const modifyOutdoorBtn = document.getElementById("modifyOutdoorBtn");
        if (modifyOutdoorBtn) {
            modifyOutdoorBtn.addEventListener("click", () => {
                runModify("Prioritize scenic mountain viewpoints, lakes, and outdoor nature exploration.", modifyOutdoorBtn, "☀️ Optimizing for outdoors...");
            });
        }

        const printBtn = document.getElementById("printItinBtn");
        if (printBtn) {
            printBtn.addEventListener("click", () => {
                window.print();
            });
        }

        const customInput = document.getElementById("customModifyInput");
        const customBtn = document.getElementById("customModifyBtn");
        if (customBtn && customInput) {
            const doCustom = () => {
                const val = customInput.value.trim();
                if (!val) return;
                runModify(val, customBtn, "⚡ Adapting...");
            };
            customBtn.addEventListener("click", doCustom);
            customInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    doCustom();
                }
            });
        }
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
