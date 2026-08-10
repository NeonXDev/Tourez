const WalletKit = (function () {
    const STORAGE_KEY = "tourezWalletV1";
    let state = { balanceNPR: 0, transactions: [], updatedAt: null };
    let preview = null;
    let previewRequestId = 0;
    let previewTimer = null;

    function moneyNPR(value) {
        return new Intl.NumberFormat("en-NP", {
            style: "currency",
            currency: "NPR",
            currencyDisplay: "symbol",
            maximumFractionDigits: 2,
        }).format(Number(value || 0)).replace("NPR", "रू");
    }

    function fmt(value) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value || 0));
    }

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (saved && typeof saved.balanceNPR === "number" && Array.isArray(saved.transactions)) {
                state = saved;
            }
        } catch (_) {
            state = { balanceNPR: 0, transactions: [], updatedAt: null };
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function normalizedCurrency() {
        const input = document.getElementById("walletCurrency");
        const code = (input?.value || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
        if (input) input.value = code;
        return code;
    }

    function renderBalance() {
        const balance = document.getElementById("walletBalance");
        const navBalance = document.getElementById("navWalletBalance");
        const updated = document.getElementById("walletUpdated");
        if (balance) balance.textContent = moneyNPR(state.balanceNPR);
        if (navBalance) navBalance.textContent = state.balanceNPR > 0
            ? moneyNPR(state.balanceNPR)
            : "रू 0";
        if (updated) {
            updated.textContent = state.updatedAt
                ? `Updated ${new Date(state.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Not funded yet";
        }
    }

    function renderHistory() {
        const wrap = document.getElementById("walletHistory");
        if (!wrap) return;
        if (!state.transactions.length) {
            wrap.innerHTML = `
                <div class="wallet-history-empty">
                    <span>🧾</span>
                    <div><strong>No wallet activity yet</strong><p>Your converted top-ups will appear here.</p></div>
                </div>`;
            return;
        }
        wrap.innerHTML = state.transactions.slice().reverse().map((tx) => `
            <div class="wallet-history-row">
                <div class="wallet-history-icon">＋</div>
                <div class="wallet-history-copy">
                    <strong>Wallet top-up</strong>
                    <span>${new Date(tx.createdAt).toLocaleString()}</span>
                </div>
                <div class="wallet-history-source">
                    <span>${fmt(tx.sourceAmount)} ${tx.sourceCurrency}</span>
                    <small>1 ${tx.sourceCurrency} = ${fmt(tx.rate)} NPR</small>
                </div>
                <div class="wallet-history-amount">+${moneyNPR(tx.nprAmount)}</div>
            </div>
        `).join("");
    }

    function renderPreviewLoading() {
        const box = document.getElementById("walletConversionPreview");
        if (box) box.innerHTML = `<div class="wallet-conversion-loading">↻ Getting the latest NPR rate…</div>`;
    }

    function renderPreviewError(message) {
        preview = null;
        const box = document.getElementById("walletConversionPreview");
        if (box) box.innerHTML = `<div class="wallet-conversion-error">⚠️ ${message}</div>`;
    }

    function renderPreview(data, amount, from) {
        const box = document.getElementById("walletConversionPreview");
        if (!box) return;
        const sourceLabel = data.source === "demo" ? "fallback demo rate" : "live exchange rate";
        box.innerHTML = `
            <div class="wallet-conversion-main">
                <div>
                    <span>You load</span>
                    <strong>${fmt(amount)} ${from}</strong>
                </div>
                <div class="wallet-conversion-arrow">→</div>
                <div>
                    <span>Tourez stores</span>
                    <strong>${moneyNPR(data.converted)}</strong>
                </div>
            </div>
            <div class="wallet-rate-line">1 ${from} = ${fmt(data.rate)} NPR · ${sourceLabel}</div>`;
    }

    async function updatePreview() {
        const amount = Number(document.getElementById("walletAmount")?.value || 0);
        const from = normalizedCurrency();
        const requestId = ++previewRequestId;

        if (!(amount > 0)) {
            renderPreviewError("Enter an amount greater than zero.");
            return;
        }
        if (!/^[A-Z]{3}$/.test(from)) {
            renderPreviewError("Enter a valid 3-letter currency code, for example USD or AUD.");
            return;
        }

        renderPreviewLoading();
        try {
            const data = await window.SmartTour.services.convertCurrency(amount, from, "NPR");
            if (requestId !== previewRequestId) return;
            if (!data || !Number.isFinite(Number(data.converted)) || Number(data.converted) <= 0) {
                throw new Error("Invalid conversion result");
            }
            preview = {
                amount,
                from,
                rate: Number(data.rate),
                converted: Number(data.converted),
                source: data.source || "exchange-rate service",
                updatedAt: data.updatedAt || new Date().toISOString(),
            };
            renderPreview(data, amount, from);
        } catch (_) {
            if (requestId !== previewRequestId) return;
            renderPreviewError(`Could not convert ${from || "that currency"} to NPR. Check the code or try again.`);
        }
    }

    function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 350);
    }

    async function topUp() {
        const btn = document.getElementById("walletTopupBtn");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Converting to NPR…";
        }
        try {
            await updatePreview();
            if (!preview) return;
            const tx = {
                id: `tx_${Date.now()}`,
                type: "topup",
                sourceAmount: preview.amount,
                sourceCurrency: preview.from,
                rate: preview.rate,
                nprAmount: preview.converted,
                source: preview.source,
                createdAt: new Date().toISOString(),
            };
            state.balanceNPR = Number((Number(state.balanceNPR || 0) + tx.nprAmount).toFixed(2));
            state.transactions.push(tx);
            state.updatedAt = tx.createdAt;
            saveState();
            renderBalance();
            renderHistory();
            window.SmartTour.UI?.showToast?.(`✅ Added ${moneyNPR(tx.nprAmount)} to your demo wallet.`, "success");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Add to Tourez Wallet";
            }
        }
    }

    function resetWallet() {
        if (!state.transactions.length && !state.balanceNPR) return;
        const ok = window.confirm("Reset the Tourez demo wallet balance and history?");
        if (!ok) return;
        state = { balanceNPR: 0, transactions: [], updatedAt: null };
        preview = null;
        saveState();
        renderBalance();
        renderHistory();
        updatePreview();
        window.SmartTour.UI?.showToast?.("Tourez demo wallet reset.");
    }

    function selectQuickCurrency(code) {
        const input = document.getElementById("walletCurrency");
        if (!input) return;
        input.value = code;
        document.querySelectorAll(".wallet-currency-chip").forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.walletCurrency === code);
        });
        updatePreview();
    }

    function init() {
        const amount = document.getElementById("walletAmount");
        const currency = document.getElementById("walletCurrency");
        const topup = document.getElementById("walletTopupBtn");
        const reset = document.getElementById("walletResetBtn");
        if (!amount || !currency || !topup) return;

        loadState();
        renderBalance();
        renderHistory();
        updatePreview();

        amount.addEventListener("input", schedulePreview);
        currency.addEventListener("input", schedulePreview);
        currency.addEventListener("change", updatePreview);
        currency.addEventListener("blur", () => {
            const code = normalizedCurrency();
            document.querySelectorAll(".wallet-currency-chip").forEach((chip) => {
                chip.classList.toggle("active", chip.dataset.walletCurrency === code);
            });
        });
        document.querySelectorAll(".wallet-currency-chip").forEach((chip) => {
            chip.addEventListener("click", () => selectQuickCurrency(chip.dataset.walletCurrency));
        });
        topup.addEventListener("click", topUp);
        reset?.addEventListener("click", resetWallet);
    }

    return { init };
})();

window.SmartTour = window.SmartTour || {};
window.SmartTour.WalletKit = WalletKit;
