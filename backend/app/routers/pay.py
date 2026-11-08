"""The client's pay page. It needs no login, so it only returns public invoice details."""
from fastapi import APIRouter, HTTPException

from app.models import PayRequest
from app.services import payments
from app.utils import get_invoice_or_404

router = APIRouter(prefix="/api/pay", tags=["pay"])


@router.get("/{invoice_id}")
def get_pay_invoice(invoice_id: str):
    return payments.public_view(get_invoice_or_404(invoice_id))


@router.post("/{invoice_id}/client-token")
def create_client_token(invoice_id: str):
    """Gives the page a short-lived key to show the Braintree payment form."""
    doc = get_invoice_or_404(invoice_id)
    try:
        return {"client_token": payments.client_token(doc)}
    except payments.PaymentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/{invoice_id}")
def pay(invoice_id: str, payload: PayRequest):
    doc = get_invoice_or_404(invoice_id)
    try:
        paid = payments.pay_invoice(doc, payload.nonce, payload.simulated_paypal)
    except payments.PaymentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except payments.PaymentDeclined as exc:
        raise HTTPException(status_code=402, detail=str(exc))
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return payments.public_view(paid)
