"""The collections agent: finds overdue invoices and drafts reminders for approval. It never sends."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from app import db as mongo
from app.models import DEFAULT_TONE_DAYS, ToneDays
from app.services import ai
from app.utils import serialize

router = APIRouter(prefix="/api/agent", tags=["agent"])

MAX_PER_RUN = 10  # keeps AI cost and run time small
# There is no login, so anyone who finds the URL could call /run. The cooldown stops the
# agent from running more than once a minute, so nobody can burn the free Groq quota
# (at most MAX_PER_RUN AI calls per minute).
RUN_COOLDOWN = timedelta(seconds=60)
REMIND_AGAIN_AFTER = timedelta(days=3)  # after a reminder was sent or a draft was dismissed


def _now() -> datetime:
    """UTC time without tzinfo, the same form PyMongo gives back."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive(dt):
    return dt.replace(tzinfo=None) if dt else None


def _iso(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt else None


def _tone_days() -> dict:
    """The freelancer's tone rules (saved from the Agent queue page), or the defaults."""
    saved = mongo.agent_state.find_one({"_id": "tone_days"}) or {}
    return {key: saved.get(key, default) for key, default in DEFAULT_TONE_DAYS.items()}


def _pick_tone(days_overdue: int, rules: dict) -> str | None:
    """The tone for this many days overdue, or None if it is too early for any reminder."""
    if days_overdue >= rules["final"]:
        return "final"
    if days_overdue >= rules["firm"]:
        return "firm"
    if days_overdue >= rules["friendly"]:
        return "friendly"
    return None


def _skip_reason(doc: dict, now: datetime) -> str | None:
    """Do not nag: skip if we reminded recently, a draft is waiting, or the draft was dismissed."""
    sent = _naive(doc.get("last_reminder_sent_at"))
    if sent and now - sent < REMIND_AGAIN_AFTER:
        return "a reminder was sent in the last 3 days"
    if doc.get("reminder_status") == "DRAFTED":
        return "a draft is already waiting for your approval"
    dismissed = _naive(doc.get("reminder_dismissed_at"))
    if doc.get("reminder_status") == "DISMISSED" and dismissed and now - dismissed < REMIND_AGAIN_AFTER:
        return "you dismissed a draft in the last 3 days"
    return None


def _cooldown_left(now: datetime) -> int:
    state = mongo.agent_state.find_one({"_id": "run"}) or {}
    last = _naive(state.get("last_run_at"))
    if not last:
        return 0
    return max(0, int((last + RUN_COOLDOWN - now).total_seconds() + 0.999))


def _claim_run(now: datetime) -> None:
    """Atomically record this run, or refuse if the agent ran less than a minute ago."""
    try:
        mongo.agent_state.find_one_and_update(
            {"_id": "run", "$or": [
                {"last_run_at": {"$lt": now - RUN_COOLDOWN}},
                {"last_run_at": {"$exists": False}},
            ]},
            {"$set": {"last_run_at": now}},
            upsert=True,  # first run ever: creates the document
        )
    except DuplicateKeyError:
        # The document exists but the last run was too recent, so the filter did not match
        seconds = _cooldown_left(now) or 1
        raise HTTPException(
            status_code=429,
            detail=f"The agent ran less than a minute ago. Try again in {seconds} seconds.",
        )


@router.post("/run")
def run_agent():
    """Check all overdue invoices and draft a reminder for each one that needs it. Sends nothing."""
    now = _now()
    _claim_run(now)
    today = date.today()
    overdue = list(
        mongo.invoices.find({"status": "SENT", "due_date": {"$lt": today.isoformat()}}).sort("due_date", 1)
    )
    rules = _tone_days()
    result = {"checked": len(overdue), "drafted": [], "skipped": [], "errors": []}

    for doc in overdue:
        info = {"id": str(doc["_id"]), "client": doc["client_name"]}
        days = (today - date.fromisoformat(doc["due_date"])).days
        tone = _pick_tone(days, rules)
        reason = _skip_reason(doc, now)
        if not reason and tone is None:
            reason = f"only {days} day{'s' if days != 1 else ''} overdue; friendly reminders start at day {rules['friendly']}"
        if not reason and len(result["drafted"]) >= MAX_PER_RUN:
            reason = "limit per run reached"
        if reason:
            result["skipped"].append({**info, "reason": reason})
            continue

        try:
            text = ai.draft_reminder(doc, days, tone)
        except ai.AIError as exc:
            result["errors"].append({**info, "error": str(exc)})
            continue

        note = f"Agent chose a {tone} tone because the invoice is {days} day{'s' if days != 1 else ''} overdue."
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

    mongo.agent_state.update_one(
        {"_id": "run"}, {"$set": {"last_result": result, "last_finished_at": _now()}}
    )
    return result


@router.get("/status")
def agent_status():
    """When the agent last ran, what it did, and how long until it may run again."""
    now = _now()
    state = mongo.agent_state.find_one({"_id": "run"}) or {}
    return {
        "last_run_at": _iso(_naive(state.get("last_run_at"))),
        "last_result": state.get("last_result"),
        "cooldown_seconds": _cooldown_left(now),
        "max_per_run": MAX_PER_RUN,
        "tone_days": _tone_days(),
    }


@router.get("/tone-days")
def get_tone_days():
    """From which day overdue the agent uses each tone, plus the defaults (for "Reset")."""
    return {**_tone_days(), "defaults": DEFAULT_TONE_DAYS}


@router.put("/tone-days")
def set_tone_days(payload: ToneDays):
    """Save new tone rules. ToneDays checks: whole numbers, friendly >= 1, firm > friendly, final > firm."""
    rules = payload.model_dump()
    mongo.agent_state.update_one({"_id": "tone_days"}, {"$set": rules}, upsert=True)
    return {**rules, "defaults": DEFAULT_TONE_DAYS}


@router.get("/queue")
def approval_queue():
    """Invoices with a reminder draft waiting for the freelancer's approval."""
    docs = mongo.invoices.find({"status": "SENT", "reminder_status": "DRAFTED"}).sort("due_date", 1)
    return [serialize(d) for d in docs]
