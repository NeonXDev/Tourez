"""currency.py — GET /api/currency endpoint."""
from fastapi import APIRouter, HTTPException, Query

from schemas import CurrencyOut
from services import currency_service

router = APIRouter(prefix="/api/currency", tags=["currency"])


@router.get("", response_model=CurrencyOut)
async def convert_currency(
    amount: float = Query(..., description="Amount to convert"),
    from_currency: str = Query(..., alias="from", description="Source currency code"),
    to_currency: str = Query(..., alias="to", description="Target currency code"),
):
    """Convert an amount between two currencies using the configured exchange-rate service."""
    try:
        return await currency_service.convert(amount, from_currency, to_currency)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Currency service unavailable: {e}")
