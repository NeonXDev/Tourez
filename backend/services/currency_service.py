"""Currency conversion using ExchangeRate-API's open access endpoint.

The endpoint requires no API key, supports NPR, and updates daily. If it is
unreachable and USE_MOCK=true, Tourez uses clearly marked demo rates.
"""
from datetime import datetime, timezone
from typing import Dict, Any

import httpx

from config import settings


_DEMO_RATES = {
    "USD:NPR": 133.5, "NPR:USD": 0.0075,
    "USD:INR": 83.2, "INR:USD": 0.012,
    "USD:EUR": 0.92, "EUR:USD": 1.09,
    "USD:GBP": 0.79, "GBP:USD": 1.27,
    "USD:JPY": 151.5, "JPY:USD": 0.0066,
    "USD:AUD": 1.52, "AUD:USD": 0.66,
    "USD:CAD": 1.36, "CAD:USD": 0.74,
    "NPR:EUR": 0.0069, "EUR:NPR": 145.0,
    "NPR:GBP": 0.0059, "GBP:NPR": 169.0,
    "NPR:JPY": 1.13, "JPY:NPR": 0.88,
    "NPR:AUD": 0.0114, "AUD:NPR": 87.8,
    "NPR:CAD": 0.0102, "CAD:NPR": 98.0,
    "NPR:INR": 0.62, "INR:NPR": 1.61,
    # Extra wallet demo fallbacks. These are clearly marked as demo rates
    # and are used only if the live exchange-rate service cannot be reached.
    "NZD:NPR": 79.5, "SGD:NPR": 102.0, "CNY:NPR": 18.4,
    "HKD:NPR": 17.1, "KRW:NPR": 0.096, "AED:NPR": 36.4,
    "QAR:NPR": 36.7, "SAR:NPR": 35.6, "MYR:NPR": 29.6,
    "THB:NPR": 3.75, "BDT:NPR": 1.12, "CHF:NPR": 151.0,
}


async def convert(amount: float, from_cur: str, to_cur: str) -> Dict[str, Any]:
    from_cur = from_cur.upper().strip()
    to_cur = to_cur.upper().strip()
    if from_cur == to_cur:
        return {
            "amount": amount, "from_currency": from_cur, "to_currency": to_cur,
            "rate": 1.0, "converted": round(amount, 2),
            "updated_at": datetime.now(timezone.utc).isoformat(), "source": "same_currency",
        }

    try:
        url = f"{settings.exchange_rate_url}/{from_cur}"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        if data.get("result") not in {None, "success"}:
            raise RuntimeError(data.get("error-type", "Exchange rate API error"))
        rate = float((data.get("rates") or {})[to_cur])
        timestamp = data.get("time_last_update_unix")
        updated_at = (
            datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat()
            if timestamp else datetime.now(timezone.utc).isoformat()
        )
        return {
            "amount": amount,
            "from_currency": from_cur,
            "to_currency": to_cur,
            "rate": rate,
            "converted": round(amount * rate, 2),
            "updated_at": updated_at,
            "source": "ExchangeRate-API",
        }
    except Exception:
        if not settings.use_mock:
            raise RuntimeError("Currency service unavailable.")
        rate = _DEMO_RATES.get(f"{from_cur}:{to_cur}")
        if rate is None:
            # Cross through USD if both legs exist in the fallback table.
            a = _DEMO_RATES.get(f"{from_cur}:USD")
            b = _DEMO_RATES.get(f"USD:{to_cur}")
            rate = (a * b) if a is not None and b is not None else None
        if rate is None:
            raise RuntimeError(
                f"No fallback rate is available for {from_cur} to {to_cur}; "
                "retry when the live exchange-rate service is reachable."
            )
        return {
            "amount": amount,
            "from_currency": from_cur,
            "to_currency": to_cur,
            "rate": rate,
            "converted": round(amount * rate, 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "demo",
        }
