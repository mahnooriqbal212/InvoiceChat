"""All Braintree calls live here.

Braintree has no invoicing API, so InvoiceChat keeps the invoice itself and gives the
client a pay link. Braintree only takes the payment. It always uses the sandbox, so
this code can never move real money.
"""
import braintree

from app.config import settings
from app.models import ZERO_DECIMAL_CURRENCIES
from app.services.paypal import PaymentError

# Braintree's own test value for a PayPal payment. It needs no PayPal account.
SIMULATED_PAYPAL_NONCE = "fake-paypal-one-time-nonce"


class PaymentDeclined(PaymentError):
    """The payment was refused (for example, a declined card). The client can try again."""


def _gateway() -> braintree.BraintreeGateway:
    if not (
        settings.braintree_merchant_id
        and settings.braintree_public_key
        and settings.braintree_private_key
    ):
        raise PaymentError("Braintree keys are missing in the backend .env file")
    return braintree.BraintreeGateway(
        braintree.Configuration(
            environment=braintree.Environment.Sandbox,
            merchant_id=settings.braintree_merchant_id,
            public_key=settings.braintree_public_key,
            private_key=settings.braintree_private_key,
        )
    )


def merchant_account_for(currency: str) -> str:
    """Find the merchant account for a currency.

    We never fall back to the default account. It could use another currency, and
    a 150 EUR invoice would then be charged as 150 USD.
    """
    account = settings.braintree_account_map.get(currency)
    if not account:
        raise PaymentError(
            f"{currency} payments are not set up yet. "
            "Add it to BRAINTREE_MERCHANT_ACCOUNTS in the backend .env file."
        )
    return account


def format_amount(value: float, currency: str) -> str:
    return f"{value:.0f}" if currency in ZERO_DECIMAL_CURRENCIES else f"{value:.2f}"


def client_token(currency: str) -> str:
    """A short-lived key that lets the pay page show the Braintree payment form."""
    try:
        return _gateway().client_token.generate(
            {"merchant_account_id": merchant_account_for(currency)}
        )
    except braintree.exceptions.braintree_error.BraintreeError as exc:
        raise PaymentError(f"Could not reach Braintree ({type(exc).__name__})") from exc


def charge(invoice: dict, nonce: str) -> dict:
    """Take the payment. The amount always comes from our database, never from the browser."""
    currency = invoice["currency"]
    gateway = _gateway()
    try:
        result = gateway.transaction.sale(
            {
                "amount": format_amount(invoice["total"], currency),
                "payment_method_nonce": nonce,
                "merchant_account_id": merchant_account_for(currency),
                "order_id": str(invoice["_id"]),
                "options": {"submit_for_settlement": True},
            }
        )
    except braintree.exceptions.braintree_error.BraintreeError as exc:
        raise PaymentError(f"Could not reach Braintree ({type(exc).__name__})") from exc

    if not result.is_success:
        raise PaymentDeclined(f"The payment did not go through: {result.message}")

    transaction = result.transaction
    # Safety check in case .env links a currency to the wrong merchant account
    if transaction.currency_iso_code != currency:
        try:
            gateway.transaction.void(transaction.id)
        except braintree.exceptions.braintree_error.BraintreeError:
            pass  # the error below still stops the invoice being marked as paid
        raise PaymentError(
            f"The merchant account for {currency} uses {transaction.currency_iso_code}. "
            "Fix BRAINTREE_MERCHANT_ACCOUNTS in the backend .env file."
        )

    return {"transaction_id": transaction.id, "method": transaction.payment_instrument_type}
