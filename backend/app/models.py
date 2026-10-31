from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# BRL, CNY and MYR only work for in-country PayPal accounts, so they are off by default.
SUPPORTED_CURRENCIES = {
    "AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "ILS", "JPY",
    "MXN", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "TWD", "USD",
    # "BRL", "CNY", "MYR",
}
# PayPal gives an error if you send decimals for these
ZERO_DECIMAL_CURRENCIES = {"HUF", "JPY", "TWD"}


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
    currency: str | None = None

    @field_validator("currency", mode="before")
    @classmethod
    def clean_currency(cls, value):
        code = value.strip().upper() if isinstance(value, str) else ""
        return code if code in SUPPORTED_CURRENCIES else None


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
    source_chat: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
    currency: str | None = "USD"

    @model_validator(mode="after")
    def check_currency(self):
        self.currency = (self.currency or "USD").upper()
        if self.currency not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency: {self.currency}")
        if self.currency in ZERO_DECIMAL_CURRENCIES:
            if any(item.unit_price != int(item.unit_price) for item in self.items):
                raise ValueError(f"{self.currency} does not support decimals. Use whole numbers.")
        return self    


# Statuses we store. "OVERDUE" is not stored: we work it out from the due date.
InvoiceStatus = Literal["DRAFT", "SENT", "PAID", "CANCELLED"]
