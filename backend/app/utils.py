from datetime import date, timezone, datetime

from bson import ObjectId
from fastapi import HTTPException

from app import db as mongo


def display_status(doc: dict) -> str:
    """What the dashboard shows: DRAFT, PENDING, OVERDUE, PAID or CANCELLED."""
    status = doc["status"]
    if status == "SENT":
        # ISO date strings (YYYY-MM-DD) compare correctly as plain text
        return "OVERDUE" if doc["due_date"] < date.today().isoformat() else "PENDING"
    return status


def serialize(doc: dict) -> dict:
    """Turn a MongoDB document into JSON-friendly data."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    for key in ("created_at", "sent_at", "paid_at", "reminder_drafted_at", "last_reminder_sent_at"):
        if out.get(key):
            out[key] = out[key].replace(tzinfo=timezone.utc).isoformat()
    if out.get("reminders"):
        out["reminders"] = [
            {**r, "sent_at": r["sent_at"].replace(tzinfo=timezone.utc).isoformat()}
            for r in out["reminders"]
        ]
    out["display_status"] = display_status(doc)
    return out


def get_invoice_or_404(invoice_id: str) -> dict:
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(status_code=404, detail="Invoice not found")
    doc = mongo.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc


def save_client(name: str, email: str | None, count: bool = True) -> None:
    """Remember a client so their details can be auto-filled next time."""
    now = datetime.now(timezone.utc)
    update: dict = {
        "$set": {"name": name.strip(), "last_invoiced_at": now},
        "$setOnInsert": {"created_at": now},
    }
    if email:
        update["$set"]["email"] = email.strip()
    if count:
        update["$inc"] = {"invoice_count": 1}
    mongo.clients.update_one({"key": name.strip().lower()}, update, upsert=True)
