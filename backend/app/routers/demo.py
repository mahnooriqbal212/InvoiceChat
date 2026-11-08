"""Demo data: fills the app with realistic sample invoices so anyone can try it."""
import uuid
from datetime import date, datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter

from app import db as mongo
from app.services.payments import pay_url
from app.utils import save_client

router = APIRouter(prefix="/api/demo", tags=["demo"])

# (client, email, currency, [(item, quantity, price)], due in N days, status)
SAMPLES = [
    ("Sara Khan", "sara.khan@example.com", "USD", [("Bakery logo design", 1, 150), ("Banner design", 2, 40)], -5, "PAID"),
    ("Liam Carter", "liam@carterstudio.example", "EUR", [("Landing page design", 1, 900)], -12, "PAID"),
    ("Aiko Tanaka", "aiko@tanaka.example", "JPY", [("Social media graphics pack", 1, 45000)], 6, "SENT"),
    ("Maya Patel", "maya@patelco.example", "GBP", [("Brand guidelines", 1, 600)], 3, "SENT"),
    ("Omar Farooq", "omar@farooq.example", "USD", [("Mobile app UI audit", 1, 450)], -9, "SENT"),
    ("Chloe Dubois", "chloe@dubois.example", "EUR", [("Logo redesign", 1, 300), ("Business cards", 2, 60)], -4, "SENT"),
    ("Noah Williams", "noah@williams.example", "USD", [("Monthly retainer, October", 1, 1200)], -21, "SENT"),
    ("Elena Rossi", "elena@rossi.example", "EUR", [("Product photo editing", 1, 280)], 10, "DRAFT"),
]


@router.post("/seed", status_code=201)
def seed_demo():
    """Replace any old demo invoices with a fresh set. Real invoices are not touched."""
    mongo.invoices.delete_many({"is_demo": True})
    now = datetime.now(timezone.utc)
    today = date.today()
    docs = []
    for index, (client, email, currency, items, due_in, status) in enumerate(SAMPLES):
        created = now - timedelta(days=20 - index * 2)
        paypal_id = f"DEMO-{uuid.uuid4().hex[:8].upper()}"
        invoice_id = ObjectId()
        docs.append({
            "_id": invoice_id,
            "client_name": client,
            "client_email": email,
            "items": [{"description": d, "quantity": q, "unit_price": p} for d, q, p in items],
            "total": round(sum(q * p for _, q, p in items), 2),
            "currency": currency,
            "due_date": (today + timedelta(days=due_in)).isoformat(),
            "notes": None,
            "source_chat": f"Sample chat with {client}",
            "status": status,
            "paypal_invoice_id": None if status == "DRAFT" else paypal_id,
            "payment_url": None if status == "DRAFT" else pay_url(invoice_id),
            "reminder_draft": None,
            "created_at": created,
            "sent_at": None if status == "DRAFT" else created + timedelta(days=1),
            "paid_at": now - timedelta(days=2 + index) if status == "PAID" else None,
            "is_demo": True,
        })
    mongo.invoices.insert_many(docs)
    for client, email, *_ in SAMPLES:
        save_client(client, email, count=False)
    return {"created": len(docs)}


@router.delete("")
def clear_demo():
    """Remove demo invoices only."""
    result = mongo.invoices.delete_many({"is_demo": True})
    return {"deleted": result.deleted_count}