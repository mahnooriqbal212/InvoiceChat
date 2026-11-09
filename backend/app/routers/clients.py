import re

from fastapi import APIRouter, Query

from app import db as mongo

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("")
def search_clients(q: str = Query("", max_length=50)):
    """Saved clients for the autocomplete box. Newest first."""
    query = {}
    if q.strip():
        query = {"key": {"$regex": re.escape(q.strip().lower())}}
    docs = mongo.clients.find(query).sort("last_invoiced_at", -1).limit(10)
    return [
        {
            "id": str(d["_id"]),
            "name": d["name"],
            "email": d.get("email"),
            "invoice_count": d.get("invoice_count", 0),
            "is_demo": bool(d.get("is_demo")),  # sample client from "Load sample data"
        }
        for d in docs
    ]