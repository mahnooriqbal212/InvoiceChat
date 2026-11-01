"""The collections agent: finds overdue invoices and drafts reminders for approval."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter

from app import db as mongo
from app.services import ai
from app.utils import serialize

router = APIRouter(prefix="/api/agent", tags=["agent"])

MAX_PER_RUN = 10  # keeps AI cost and run time small


def _naive(dt):
    return dt.replace(tzinfo=None) if dt else None


def _pick_tone(days_overdue: int) -> str:
    if days_overdue <= 3:
        return "friendly"
    if days_overdue <= 14:
        return "firm"
    return "final"


def _skip_reason(doc: dict, now: datetime) -> str | None:
    """Do not nag: skip if we reminded recently or a draft is already waiting."""
    sent = _naive(doc.get("last_reminder_sent_at"))
    drafted = _naive(doc.get("reminder_drafted_at"))
    if sent and now - sent < timedelta(days=3):
        return "reminder sent in the last 3 days"
    if doc.get("reminder_status") == "DRAFTED" and drafted and now - drafted < timedelta(hours=24):
        return "draft already waiting for approval"
    return None


@router.post("/run")
def run_agent():
    """Check all overdue invoices and draft a reminder for each one that needs it."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = date.today()
    overdue = list(
        mongo.invoices.find({"status": "SENT", "due_date": {"$lt": today.isoformat()}}).sort("due_date", 1)
    )
    result = {"checked": len(overdue), "drafted": [], "skipped": [], "errors": []}

    for doc in overdue:
        info = {"id": str(doc["_id"]), "client": doc["client_name"]}
        reason = _skip_reason(doc, now)
        if not reason and len(result["drafted"]) >= MAX_PER_RUN:
            reason = "limit per run reached"
        if reason:
            result["skipped"].append({**info, "reason": reason})
            continue

        days = (today - date.fromisoformat(doc["due_date"])).days
        tone = _pick_tone(days)
        try:
            text = ai.draft_reminder(doc, days, tone)
        except ai.AIError as exc:
            result["errors"].append({**info, "error": str(exc)})
            continue

        note = f"Agent chose a {tone} tone because the invoice is {days} day(s) overdue."
        mongo.invoices.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "reminder_draft": text,
                "reminder_tone": tone,
                "reminder_status": "DRAFTED",
                "reminder_drafted_at": datetime.now(timezone.utc),
                "agent_note": note,
            }},
        )
        result["drafted"].append({**info, "days_overdue": days, "tone": tone, "reason": note})

    return result


@router.get("/queue")
def approval_queue():
    """Invoices with a reminder draft waiting for the freelancer's approval."""
    docs = mongo.invoices.find({"status": "SENT", "reminder_status": "DRAFTED"}).sort("due_date", 1)
    return [serialize(d) for d in docs]