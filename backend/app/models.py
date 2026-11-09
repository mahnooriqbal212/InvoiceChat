import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# Client email rule. Keep this rule the same as frontend/src/lib/invoiceForm.js (EMAIL and
# EMAIL_MAX_LENGTH), so the browser and the server never disagree about an address.
# It checks the shape only (something@something.something, no spaces). Nobody can check
# that an inbox really exists without sending it a message.
# Python's "\s" and str.strip() treat a few rare invisible characters differently from
# JavaScript's "\s" and trim(), so we spell out JavaScript's exact list of space characters.
JS_SPACES = "\t\n\v\f\r    -     　﻿"
EMAIL_PATTERN = re.compile(f"[^{JS_SPACES}@]+@[^{JS_SPACES}@]+\\.[^{JS_SPACES}@]+")
JS_TRIM = re.compile(f"^[{JS_SPACES}]+|[{JS_SPACES}]+$")
EMAIL_MAX_LENGTH = 254  # the longest an email address can be


def js_length(text: str) -> int:
    """Length the way JavaScript counts it (an emoji counts as 2), to match the browser check."""
    return len(text.encode("utf-16-le")) // 2


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
    unit_price: float = Field(default=0, allow_inf_nan=False)


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
    language: Literal["original", "english"] = "original"


class ExtractResponse(BaseModel):
    invoice: ExtractedInvoice
    warnings: list[str] = []
    autofilled: list[str] = []  # fields filled from saved clients


TONE_DAYS_MAX = 365  # keeps the numbers finite and sensible
DEFAULT_TONE_DAYS = {"friendly": 1, "firm": 4, "final": 15}  # = up to 3 days friendly, up to 14 firm


class ToneDays(BaseModel):
    """From which day overdue the collections agent uses each tone.

    Keep these rules and messages the same as frontend/src/lib/toneDays.js.
    """
    friendly: int
    firm: int
    final: int

    @field_validator("friendly", "firm", "final", mode="before")
    @classmethod
    def whole_number(cls, value):
        # bool is a kind of int in Python, and 3.5 or "3" are not whole numbers typed by the user
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("Enter a whole number of days.")
        if value > TONE_DAYS_MAX:
            raise ValueError(f"Use {TONE_DAYS_MAX} days or fewer.")
        return value

    @model_validator(mode="after")
    def in_order(self):
        if self.friendly < 1:
            raise ValueError("Friendly must start at day 1 or later.")
        if self.firm <= self.friendly:
            raise ValueError("Firm must start after the friendly day.")
        if self.final <= self.firm:
            raise ValueError("Final must start after the firm day.")
        return self


class ReminderSend(BaseModel):
    text: str | None = Field(default=None, max_length=4000)


class PayRequest(BaseModel):
    nonce: str | None = Field(default=None, max_length=4000)  # one-time code from the payment form
    simulated_paypal: bool = False


# ---------- What we save (strict: must be correct before it goes to PayPal) ----------

class LineItem(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(gt=0, allow_inf_nan=False)  # Infinity or NaN would break the total


class InvoiceCreate(BaseModel):
    client_name: str = Field(min_length=1, max_length=100)
    client_email: str | None = None
    items: list[LineItem] = Field(min_length=1)
    due_date: date
    source_chat: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
    currency: str | None = "USD"

    @field_validator("client_email", mode="before")
    @classmethod
    def check_email(cls, value):
        """Trim spaces; empty means "no email" (allowed); otherwise it must look like an email."""
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("This does not look like an email address.")
        value = JS_TRIM.sub("", value)  # same as JavaScript's trim()
        if not value:
            return None
        if js_length(value) > EMAIL_MAX_LENGTH:
            raise ValueError(f"Keep the email under {EMAIL_MAX_LENGTH} characters.")
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("This does not look like an email address.")
        return value

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
