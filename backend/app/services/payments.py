"""One entry point for payments. Routers call this, never a provider directly.

PAYMENT_PROVIDER=fake      -> works with no account (for building and testing)
PAYMENT_PROVIDER=braintree -> the client pays on our pay page, through the Braintree sandbox
PAYMENT_PROVIDER=paypal    -> real PayPal sandbox invoices
"""
import uuid
from datetime import datetime, timedelta, timezone

from app import db as mongo
from app.config import settings
from app.services import braintree_provider, paypal
from app.services.braintree_provider import SIMULATED_PAYPAL_NONCE, PaymentDeclined
from app.services.paypal import PaymentError  # re-exported for the routers
from app.utils import display_status

__all__ = [
    "PaymentConflict",
    "PaymentDeclined",
    "PaymentError",
    "client_token",
    "create_and_send_invoice",
    "pay_invoice",
    "pay_url",
    "public_view",
    "send_reminder",
]

# A payment that started this long ago and never finished no longer blocks a new try
PAYMENT_LOCK = timedelta(minutes=2)


class PaymentConflict(PaymentError):
    """This invoice cannot be paid right now (for example, a payment is already running)."""


def pay_url(invoice_id) -> str:
    """The page we host where the client sees the invoice and pays it."""
    return f"{settings.frontend_url.rstrip('/')}/pay/{invoice_id}"


def create_and_send_invoice(invoice: dict) -> dict:
    if settings.payment_provider == "paypal":
        return paypal.create_and_send_invoice(invoice)

    if settings.payment_provider == "braintree":
        # Stops here with a clear message if this currency has no merchant account
        braintree_provider.merchant_account_for(invoice["currency"])
        prefix = "BT"
    else:
        prefix = "FAKE"

    return {
        "provider_invoice_id": f"{prefix}-{uuid.uuid4().hex[:10].upper()}",
        "payment_url": pay_url(invoice["_id"]),
    }


def send_reminder(invoice: dict, note: str) -> None:
    pid = str(invoice.get("paypal_invoice_id") or "")
    # Only real PayPal invoices can be reminded through a provider
    if settings.payment_provider == "paypal" and not pid.startswith(("FAKE-", "DEMO-")):
        paypal.send_reminder(invoice, note)


def _checkout_mode(invoice: dict) -> str:
    """How the pay page takes this payment: "test", "braintree" or "paypal"."""
    if invoice.get("is_demo") or settings.payment_provider == "fake":
        return "test"
    return settings.payment_provider


def public_view(invoice: dict) -> dict:
    """Only what the client needs. It leaves out the source chat and reminder notes."""
    mode = _checkout_mode(invoice)
    return {
        "id": str(invoice["_id"]),
        "client_name": invoice["client_name"],
        "items": invoice["items"],
        "total": invoice["total"],
        "currency": invoice["currency"],
        "due_date": invoice["due_date"],
        "notes": invoice.get("notes"),
        "status": invoice["status"],
        # The server decides "overdue", so the pay page and the dashboard always agree
        "display_status": display_status(invoice),
        "paid_at": invoice["paid_at"].replace(tzinfo=timezone.utc).isoformat() if invoice.get("paid_at") else None,
        "payment_method": invoice.get("payment_method"),
        "checkout_mode": mode,
        "amount": braintree_provider.format_amount(invoice["total"], invoice["currency"]),
        "paypal_url": invoice.get("payment_url") if mode == "paypal" else None,
        "simulated_paypal": mode == "braintree" and settings.braintree_simulated_paypal,
    }


def _require_braintree_checkout(invoice: dict) -> None:
    if _checkout_mode(invoice) != "braintree":
        raise PaymentConflict("This invoice is not paid through Braintree")
    if invoice["status"] != "SENT":
        raise PaymentConflict("This invoice is not waiting for payment")


def client_token(invoice: dict) -> str:
    _require_braintree_checkout(invoice)
    return braintree_provider.client_token(invoice["currency"])


def pay_invoice(invoice: dict, nonce: str | None, simulated_paypal: bool = False) -> dict:
    """Charge the invoice once, then mark it PAID. Returns the updated invoice."""
    _require_braintree_checkout(invoice)
    if simulated_paypal:
        if not settings.braintree_simulated_paypal:
            raise PaymentConflict("Simulated PayPal payments are turned off")
        nonce = SIMULATED_PAYPAL_NONCE
    elif not nonce:
        raise PaymentConflict("No payment details were received")

    # Only one payment can hold this lock, so a double click cannot charge twice
    now = datetime.now(timezone.utc)
    locked = mongo.invoices.update_one(
        {
            "_id": invoice["_id"],
            "status": "SENT",
            "$or": [{"paying_at": None}, {"paying_at": {"$lt": now - PAYMENT_LOCK}}],
        },
        {"$set": {"paying_at": now}},
    )
    if not locked.matched_count:
        raise PaymentConflict("A payment for this invoice is already in progress")

    try:
        charged = braintree_provider.charge(invoice, nonce)
    except PaymentError:
        mongo.invoices.update_one({"_id": invoice["_id"]}, {"$set": {"paying_at": None}})
        raise

    updates = {
        "status": "PAID",
        "paid_at": datetime.now(timezone.utc),
        "paying_at": None,
        "braintree_transaction_id": charged["transaction_id"],
        "payment_method": "PayPal (simulated)" if simulated_paypal else _method_label(charged["method"]),
    }
    mongo.invoices.update_one({"_id": invoice["_id"]}, {"$set": updates})
    return {**invoice, **updates}


def _method_label(method: str | None) -> str:
    return {"credit_card": "Card", "paypal_account": "PayPal"}.get(method or "", "Braintree")
