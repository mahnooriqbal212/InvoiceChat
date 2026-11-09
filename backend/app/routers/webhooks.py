import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from app import db as mongo
from app.config import settings
from app.services import payments, paypal
from app.utils import get_invoice_or_404

router = APIRouter(prefix="/api", tags=["webhooks"])


def _invoice_id_from(resource: dict) -> str | None:
    """Find the PayPal invoice id inside a webhook (the shape can vary a little)."""
    inv = resource.get("invoice") or resource
    found = inv.get("id")
    if not found:
        href = inv.get("href") or resource.get("href") or ""
        found = href.rstrip("/").split("/")[-1]
    return found or None


def apply_event(event: dict) -> str:
    """Update our invoice from a PayPal event. Returns what happened."""
    event_type = event.get("event_type", "")
    resource = event.get("resource") or {}
    paypal_id = _invoice_id_from(resource)
    if not paypal_id:
        return "no_invoice_id"

    inv = resource.get("invoice") or resource

    if event_type == "INVOICING.INVOICE.PAID":
        # This event also fires for partial or pending payments. Only full payment counts.
        if inv.get("status") not in (None, "PAID", "MARKED_AS_PAID"):
            return "ignored_partial_payment"
        result = mongo.invoices.update_one(
            {"paypal_invoice_id": paypal_id},
            {"$set": {"status": "PAID", "paid_at": datetime.now(timezone.utc)}},
        )
    elif event_type == "INVOICING.INVOICE.CANCELLED":
        result = mongo.invoices.update_one(
            {"paypal_invoice_id": paypal_id, "status": {"$ne": "PAID"}},
            {"$set": {"status": "CANCELLED"}},
        )
    else:
        return "ignored_event_type"

    return "updated" if result.matched_count else "unknown_invoice"


@router.post("/webhooks/paypal")
def paypal_webhook(request: Request, event: dict = Body(...)):
    """PayPal calls this when an invoice changes."""
    # Whenever PayPal is set up, every event must pass PayPal's signature check. This also works
    # after switching PAYMENT_PROVIDER to braintree, so PayPal invoices sent earlier still turn PAID.
    if settings.payment_provider == "paypal" or settings.paypal_webhook_id:
        if not paypal.verify_webhook(request.headers, event):
            raise HTTPException(status_code=400, detail="Webhook signature check failed")
    elif settings.payment_provider == "braintree":
        # PayPal is not set up, so nothing can verify these events and a stranger could fake a payment
        raise HTTPException(status_code=404, detail="Not found")
    # (fake mode without PayPal: unverified events are accepted, for local testing only)

    event_id = event.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event id")

    # Save every event once. A repeat of the same event is skipped.
    try:
        mongo.webhook_events.insert_one(
            {
                "event_id": event_id,
                "event_type": event.get("event_type"),
                "received_at": datetime.now(timezone.utc),
                "raw": event,
            }
        )
    except DuplicateKeyError:
        return {"result": "duplicate"}

    return {"result": apply_event(event)}


@router.post("/dev/simulate-payment/{invoice_id}")
def simulate_payment(invoice_id: str):
    """Testing helper: pretend the client paid a test invoice (sample, or sent in fake mode)."""
    doc = get_invoice_or_404(invoice_id)
    # Only invoices whose pay page shows the "Simulate payment (test)" button.
    # Real Braintree or PayPal invoices can never be marked paid this way.
    if payments.checkout_mode(doc) != "test":
        raise HTTPException(status_code=404, detail="Not found")
    if doc["status"] != "SENT":
        raise HTTPException(status_code=409, detail="Invoice must be sent first")

    fake_event = {
        "id": f"SIM-{uuid.uuid4().hex[:12]}",
        "event_type": "INVOICING.INVOICE.PAID",
        "resource": {"invoice": {"id": doc["paypal_invoice_id"], "status": "PAID"}},
    }
    mongo.webhook_events.insert_one(
        {
            "event_id": fake_event["id"],
            "event_type": fake_event["event_type"],
            "received_at": datetime.now(timezone.utc),
            "raw": fake_event,
        }
    )
    return {"result": apply_event(fake_event)}
