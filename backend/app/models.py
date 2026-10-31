from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# ---------- What the AI gives back (lenient: the user will review and fix) ----------

class ExtractedItem(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float = 0


class ExtractedInvoice(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    items: list[ExtractedItem] = []
    due_date: date | None = None
    notes: str | None = None


class ExtractRequest(BaseModel):
    chat_text: str = Field(min_length=10, max_length=8000)


class ExtractResponse(BaseModel):
    invoice: ExtractedInvoice
    warnings: list[str] = []


# ---------- What we save (strict: must be correct before it goes to PayPal) ----------

class LineItem(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(gt=0)


class InvoiceCreate(BaseModel):
    client_name: str = Field(min_length=1, max_length=100)
    client_email: str | None = None
    items: list[LineItem] = Field(min_length=1)
    due_date: date
    notes: str | None = Field(default=None, max_length=1000)
    source_chat: str | None = None


# Statuses we store. "OVERDUE" is not stored: we work it out from the due date.
InvoiceStatus = Literal["DRAFT", "SENT", "PAID", "CANCELLED"]
