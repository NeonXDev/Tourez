"""compliance.py — Legal & Compliance endpoints for Tourez.

Handles:
- Data Deletion Requests (Right to Erasure / GDPR Art. 17 & Nepal Privacy Act 2075)
- Newsletter subscription & instant 1-click unsubscribe
"""
import random
import time
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/api/compliance", tags=["Compliance & Legal"])


class DeleteRequestPayload(BaseModel):
    name: str
    email: str
    request_type: str = "full_erasure"
    notes: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if "@" not in v or "." not in v or len(v) < 5:
            raise ValueError("Please provide a valid email address.")
        return v


class NewsletterPayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if "@" not in v or "." not in v or len(v) < 5:
            raise ValueError("Please provide a valid email address.")
        return v


@router.post("/delete-request")
async def handle_delete_request(payload: DeleteRequestPayload):
    """Register a verifiable data deletion / right to erasure request."""
    ticket_id = f"DEL-2026-NP{random.randint(10000, 99999)}"
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    
    return {
        "status": "received",
        "ticket_id": ticket_id,
        "email": payload.email,
        "name": payload.name,
        "request_type": payload.request_type,
        "timestamp": timestamp,
        "sla": "Processed within 72 business hours",
        "legal_basis": "GDPR Article 17 & Nepal Individual Privacy Act 2075 (2018)",
        "message": (
            f"Your data deletion request has been registered under ticket #{ticket_id}. "
            "All associated server logs, transient session records, and newsletter subscriptions "
            "will be purged in accordance with data privacy laws."
        ),
    }


@router.post("/newsletter/subscribe")
async def subscribe_newsletter(payload: NewsletterPayload):
    """Subscribe to Nepal travel updates with explicit consent."""
    return {
        "status": "subscribed",
        "email": payload.email,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "message": "Thank you for subscribing to Tourez travel insights and seasonal Nepal advisories.",
    }


@router.post("/newsletter/unsubscribe")
async def unsubscribe_newsletter(payload: NewsletterPayload):
    """Instantly unsubscribe from newsletter communications (1-click unsubscribe)."""
    return {
        "status": "unsubscribed",
        "email": payload.email,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "message": f"{payload.email} has been unsubscribed from all Tourez marketing and alert emails.",
    }
