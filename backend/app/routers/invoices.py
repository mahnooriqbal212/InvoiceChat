from datetime import date, datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from app import db as mongo
from app.services import ai, payments
from app.models import InvoiceCreate, ReminderSend
from app.utils import display_status, get_invoice_or_404, save_client, serialize

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.post("", status_code=201)
def create_invoice(payload: InvoiceCreate):
    """Save a reviewed invoice as a DRAFT in our database (PayPal is not called yet)."""
    data = payload.model_dump(mode="json")  # dates become "YYYY-MM-DD" text
    total = round(sum(i["quantity"] * i["unit_price"] for i in data["items"]), 2)
    doc = {
        **data,
        "total": total,  # we calculate it, never the AI
        "currency": data["currency"],
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
    save_client(payload.client_name, payload.client_email)
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
    """Dashboard numbers grouped by currency (we never add different currencies)."""
    result: dict = {}
    for doc in mongo.invoices.find({"status": {"$in": ["SENT", "PAID"]}}):
        currency = doc.get("currency", "USD")
        buckets = result.setdefault(
            currency,
            {k: {"count": 0, "amount": 0.0} for k in ("PAID", "PENDING", "OVERDUE")},
        )
        bucket = buckets[display_status(doc)]
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
        "payment_provider": sent["provider"],  # "demo" for sample invoices
        "sent_at": datetime.now(timezone.utc),
    }
    mongo.invoices.update_one({"_id": doc["_id"]}, {"$set": updates})
    return serialize({**doc, **updates})


@router.post("/{invoice_id}/reminder-draft")
def reminder_draft(
    invoice_id: str,
    tone: str = Query("friendly", description="friendly, firm or final"),
):
    """AI writes a reminder message in the chosen tone. Nothing is sent yet."""
    if tone not in ai.REMINDER_TONES:
        raise HTTPException(status_code=400, detail="tone must be friendly, firm or final")
    doc = get_invoice_or_404(invoice_id)
    if doc["status"] != "SENT":
        raise HTTPException(status_code=409, detail="Reminders are only for sent, unpaid invoices")

    days_overdue = max((date.today() - date.fromisoformat(doc["due_date"])).days, 0)
    try:
        text = ai.draft_reminder(doc, days_overdue, tone)
    except ai.AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    mongo.invoices.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "reminder_draft": text,
            "reminder_tone": tone,
            "reminder_status": "DRAFTED",
            "reminder_drafted_at": datetime.now(timezone.utc),
        }},
    )
    return {"reminder_draft": text, "tone": tone, "days_overdue": days_overdue}


@router.post("/{invoice_id}/reminder/send")
def send_reminder(invoice_id: str, payload: ReminderSend | None = None):
    """The freelancer approves: PayPal emails its reminder, and we log the approved message."""
    doc = get_invoice_or_404(invoice_id)
    if doc["status"] != "SENT":
        raise HTTPException(status_code=409, detail="Reminders are only for sent, unpaid invoices")

    text = ((payload.text if payload else None) or doc.get("reminder_draft") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write or generate a reminder first")

    try:
        payments.send_reminder(doc, text)
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    now = datetime.now(timezone.utc)
    mongo.invoices.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {"reminder_status": "SENT", "last_reminder_sent_at": now},
            "$push": {"reminders": {"sent_at": now, "tone": doc.get("reminder_tone"), "text": text}},
        },
    )
    return serialize(mongo.invoices.find_one({"_id": doc["_id"]}))