"""All real PayPal calls live here. Uses the PayPal Invoicing API (v2)."""
import time
from datetime import date

import httpx

from app.config import settings
from app.models import ZERO_DECIMAL_CURRENCIES


class PaymentError(Exception):
    """Raised when PayPal rejects a request or cannot be reached."""


_token_cache = {"value": None, "expires_at": 0.0}


def _check(response: httpx.Response) -> None:
    if response.status_code >= 400:
        raise PaymentError(f"PayPal error {response.status_code}: {response.text[:500]}")


def _get_token() -> str:
    """Get an access token. It is cached until shortly before it expires."""
    if _token_cache["value"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["value"]
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise PaymentError("PayPal credentials are missing in .env")
    try:
        response = httpx.post(
            f"{settings.paypal_base_url}/v1/oauth2/token",
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            data={"grant_type": "client_credentials"},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise PaymentError(f"Could not reach PayPal: {exc}") from exc
    _check(response)
    data = response.json()
    _token_cache["value"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 300))
    return _token_cache["value"]


def _format_amount(value: float, currency: str) -> str:
    return f"{value:.0f}" if currency in ZERO_DECIMAL_CURRENCIES else f"{value:.2f}"


def _build_invoice_payload(invoice: dict) -> dict:
    today = date.today().isoformat()

    # PayPal may reject a due date in the past, so for those we ask for "due on receipt".
    # We still keep the real due date in our own database for the overdue logic.
    if invoice["due_date"] >= today:
        payment_term = {"term_type": "DUE_ON_DATE_SPECIFIED", "due_date": invoice["due_date"]}
    else:
        payment_term = {"term_type": "DUE_ON_RECEIPT"}

    detail = {
        "invoice_date": today,
        "currency_code": invoice["currency"],
        "payment_term": payment_term,
    }
    if invoice.get("notes"):
        detail["note"] = invoice["notes"][:1000]

    first, _, last = invoice["client_name"].strip().partition(" ")
    name = {"given_name": first}
    if last:
        name["surname"] = last
    billing_info = {"name": name}
    if invoice.get("client_email"):
        billing_info["email_address"] = invoice["client_email"]

    items = [
        {
            "name": item["description"][:200],
            "quantity": str(item["quantity"]),
            "unit_amount": {
                "currency_code": invoice["currency"],
                "value": _format_amount(item["unit_price"], invoice["currency"]),
            },
        }
        for item in invoice["items"]
    ]
    return {
        "detail": detail,
        "primary_recipients": [{"billing_info": billing_info}],
        "items": items,
    }


def create_and_send_invoice(invoice: dict) -> dict:
    """Create a draft invoice on PayPal, send it, and return its id and payment link."""
    token = _get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    base = f"{settings.paypal_base_url}/v2/invoicing/invoices"

    try:
        with httpx.Client(timeout=30) as http:
            # 1) create draft
            r = http.post(base, json=_build_invoice_payload(invoice), headers=headers)
            _check(r)
            data = r.json()
            # Some responses give "id", others only a link ending with the id
            paypal_id = data.get("id") or data.get("href", "").rstrip("/").split("/")[-1]
            if not paypal_id:
                raise PaymentError(f"Could not read the invoice id from PayPal: {data}")

            # 2) send it. Without an email we only make a share link (no email sent).
            send_body = {
                "send_to_recipient": bool(invoice.get("client_email")),
                "send_to_invoicer": False,
            }
            _check(http.post(f"{base}/{paypal_id}/send", json=send_body, headers=headers))

            # 3) read it back to get the link the client uses to pay
            r = http.get(f"{base}/{paypal_id}", headers=headers)
            _check(r)
            metadata = r.json().get("detail", {}).get("metadata", {})
            payment_url = metadata.get("recipient_view_url")
    except httpx.HTTPError as exc:
        raise PaymentError(f"Could not reach PayPal: {exc}") from exc

    return {"provider_invoice_id": paypal_id, "payment_url": payment_url}


def verify_webhook(headers, event: dict) -> bool:
    """Ask PayPal to confirm that a webhook really came from PayPal."""
    if not settings.paypal_webhook_id:
        return False
    body = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
        "webhook_id": settings.paypal_webhook_id,
        "webhook_event": event,
    }
    try:
        token = _get_token()
        response = httpx.post(
            f"{settings.paypal_base_url}/v1/notifications/verify-webhook-signature",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
    except (httpx.HTTPError, PaymentError):
        return False
    return response.status_code == 200 and response.json().get("verification_status") == "SUCCESS"
