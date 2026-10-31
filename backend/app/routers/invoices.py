from datetime import date, datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from app import db as mongo
from app.models import InvoiceCreate
from app.services import ai, payments
from app.utils import display_status, get_invoice_or_404, serialize

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.post("", status_code=201)
def create_invoice(payload: InvoiceCreate):
    """Save a reviewed invoice as a DRAFT in our database (PayPal is not called yet)."""
    data = payload.model_dump(mode="json")  # dates become "YYYY-MM-DD" text
    total = round(sum(i["quantity"] * i["unit_price"] for i in data["items"]), 2)
    doc = {
        **data,
        "total": total,  # we calculate it, never the AI
        "currency": "USD",
        "status": "DRAFT",
        "paypal_invoice_id": None,
        "payment_url": None,
        "reminder_draft": None,
        "created_at": datetime.now(timezone.utc),
        "sent_at": None,
        "paid_at": None,
    }
    result = mongo.invoices.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("")
def list_invoices(
    status: str | None = Query(
        default=None, description="DRAFT, PENDING, OVERDUE, PAID or CANCELLED"
    ),
):
    today = date.today().isoformat()
    query: dict = {}
    if status:
        status = status.upper()
        if status == "OVERDUE":
            query = {"status": "SENT", "due_date": {"$lt": today}}
        elif status == "PENDING":
            query = {"status": "SENT", "due_date": {"$gte": today}}
        elif status in ("DRAFT", "PAID", "CANCELLED"):
            query = {"status": status}
        else:
            raise HTTPException(status_code=400, detail="Unknown status filter")
    docs = mongo.invoices.find(query).sort("created_at", -1).limit(200)
    return [serialize(d) for d in docs]


@router.get("/summary")
def summary():
    """Numbers for the dashboard cards."""
    result = {
        "PAID": {"count": 0, "amount": 0.0},
        "PENDING": {"count": 0, "amount": 0.0},
        "OVERDUE": {"count": 0, "amount": 0.0},
    }
    for doc in mongo.invoices.find({"status": {"$in": ["SENT", "PAID"]}}):
        bucket = result[display_status(doc)]
        bucket["count"] += 1
        bucket["amount"] = round(bucket["amount"] + doc["total"], 2)
    return result


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str):
    return serialize(get_invoice_or_404(invoice_id))


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: str):
    doc = get_invoice_or_404(invoice_id)
    if doc["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft invoices can be deleted")
    mongo.invoices.delete_one({"_id": doc["_id"]})
    return {"deleted": True}


@router.post("/{invoice_id}/send")
def send_invoice(invoice_id: str):
    """Create and send the invoice through the payment provider, then mark it SENT."""
    doc = get_invoice_or_404(invoice_id)
    if doc["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft invoices can be sent")

    try:
        sent = payments.create_and_send_invoice(doc)
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    updates = {
        "status": "SENT",
        "paypal_invoice_id": sent["provider_invoice_id"],
        "payment_url": sent["payment_url"],
        "sent_at": datetime.now(timezone.utc),
    }
    mongo.invoices.update_one({"_id": doc["_id"]}, {"$set": updates})
    return serialize({**doc, **updates})


@router.post("/{invoice_id}/reminder-draft")
def reminder_draft(invoice_id: str):
    """AI writes a polite reminder. We only draft it; the freelancer sends it."""
    doc = get_invoice_or_404(invoice_id)
    if doc["status"] != "SENT":
        raise HTTPException(status_code=409, detail="Reminders are only for sent, unpaid invoices")

    days_overdue = (date.today() - date.fromisoformat(doc["due_date"])).days
    try:
        text = ai.draft_reminder(doc, max(days_overdue, 0))
    except ai.AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    mongo.invoices.update_one({"_id": doc["_id"]}, {"$set": {"reminder_draft": text}})
    return {"reminder_draft": text, "days_overdue": max(days_overdue, 0)}
