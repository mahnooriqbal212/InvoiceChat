from fastapi import APIRouter, HTTPException

from app.models import ExtractRequest, ExtractResponse
from app.services import ai

router = APIRouter(prefix="/api", tags=["extract"])


@router.post("/extract", response_model=ExtractResponse)
def extract(payload: ExtractRequest):
    """Chat text in, invoice draft out. Nothing is saved here."""
    try:
        invoice = ai.extract_invoice(payload.chat_text)
    except ai.AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Tell the user what to double-check on the review screen
    warnings = []
    if not invoice.client_name:
        warnings.append("Client name not found.")
    if not invoice.items:
        warnings.append("No work items found.")
    if any(item.unit_price <= 0 for item in invoice.items):
        warnings.append("Some items have no price. Please fill them in.")
    if not invoice.due_date:
        warnings.append("Due date not found.")
    if not invoice.currency:
        warnings.append("Currency not found or not supported by PayPal. Please choose one.")
    if not invoice.client_email:
        warnings.append("Client email not found. PayPal needs it to email the invoice.")

    return ExtractResponse(invoice=invoice, warnings=warnings)
