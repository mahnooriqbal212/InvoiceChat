"""One entry point for payments. Routers call this, never PayPal directly.

PAYMENT_PROVIDER=fake   -> works with no account (for building and testing)
PAYMENT_PROVIDER=paypal -> real PayPal sandbox calls
"""
import uuid

from app.config import settings
from app.services import paypal
from app.services.paypal import PaymentError  # re-exported for the routers

__all__ = ["PaymentError", "create_and_send_invoice"]


def create_and_send_invoice(invoice: dict) -> dict:
    if settings.payment_provider == "paypal":
        return paypal.create_and_send_invoice(invoice)

    fake_id = f"FAKE-{uuid.uuid4().hex[:10].upper()}"
    return {
        "provider_invoice_id": fake_id,
        "payment_url": f"https://example.com/fake-invoice/{fake_id}",
    }
