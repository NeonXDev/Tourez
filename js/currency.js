const CurrencyKit = (function () {
    function formatNumber(n) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
    }

    async function convert() {
        const amount = +document.getElementById("curAmount").value || 0;
        const from = document.getElementById("curFrom").value;
        const to = document.getElementById("curTo").value;
        const result = document.getElementById("currencyResult");
        result.innerHTML = `<span class="cur-loading">💱 Fetching live exchange rate...</span>`;
        try {
            const data = await window.SmartTour.services.convertCurrency(amount, from, to);
            const time = new Date(data.updatedAt).toLocaleTimeString();
            const sourceText = data.source === "ExchangeRate-API"
                ? ' · <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates by Exchange Rate API</a>'
                : data.source === "demo" ? " · demo fallback rate" : "";
            result.innerHTML = `
                <div class="cur-conversion">${formatNumber(amount)} ${from} = <span style="color:var(--brand-2);">${formatNumber(data.converted)} ${to}</span></div>
                <div class="cur-rate">1 ${from} = ${formatNumber(data.rate)} ${to}</div>
                <div class="cur-updated">Updated ${time}${sourceText}</div>
            `;
        } catch (e) {
            result.innerHTML = `<div class="cur-error">⚠️ Currency service unavailable. Please try again later.</div>`;
        }
    }

    function swap() {
        const from = document.getElementById("curFrom");
        const to = document.getElementById("curTo");
        const tmp = from.value;
        from.value = to.value;
        to.value = tmp;
        convert();
    }

    function init() {
        document.getElementById("curAmount").addEventListener("input", convert);
        document.getElementById("curFrom").addEventListener("change", convert);
        document.getElementById("curTo").addEventListener("change", convert);
        document.getElementById("swapBtn").addEventListener("click", swap);
        convert();
    }

    return { init };
})();

window.SmartTour = window.SmartTour || {};
window.SmartTour.CurrencyKit = CurrencyKit;
