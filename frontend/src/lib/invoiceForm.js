import { CURRENCIES, isZeroDecimal } from "@/lib/money";

let nextKey = 0;

// One empty line item. `key` is only for React lists; it is never sent to the server.
export function newItem(item = {}) {
  return {
    key: ++nextKey,
    description: item.description ?? "",
    quantity: String(item.quantity ?? 1),
    unit_price: item.unit_price ? String(item.unit_price) : "",
  };
}

// AI result (ExtractedInvoice) -> form state. Inputs hold text, so numbers become strings.
export function toForm(invoice) {
  const items = invoice.items?.length ? invoice.items.map(newItem) : [newItem()];
  return {
    client_name: invoice.client_name ?? "",
    client_email: invoice.client_email ?? "",
    currency: invoice.currency ?? "",
    due_date: invoice.due_date ?? "",
    notes: invoice.notes ?? "",
    items,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rules as the backend's InvoiceCreate model, so most mistakes are caught before saving.
// Returns {} when everything is fine.
export function validate(form) {
  const errors = {};
  if (!form.client_name.trim()) errors.client_name = "Client name is required.";
  else if (form.client_name.trim().length > 100) errors.client_name = "Keep it under 100 characters.";
  if (form.client_email.trim() && !EMAIL.test(form.client_email.trim())) {
    errors.client_email = "This does not look like an email address.";
  }
  if (!CURRENCIES.includes(form.currency)) errors.currency = "Choose a currency.";
  if (!form.due_date) errors.due_date = "Choose a due date.";
  if (form.notes.length > 1000) errors.notes = "Keep notes under 1000 characters.";

  const itemErrors = {};
  form.items.forEach((item, index) => {
    const e = {};
    const quantity = Number(item.quantity);
    const price = Number(item.unit_price);
    if (!item.description.trim()) e.description = "Describe the work.";
    if (!Number.isInteger(quantity) || quantity < 1) e.quantity = "Whole number, 1 or more.";
    if (!item.unit_price || !(price > 0)) e.unit_price = "Enter a price above 0.";
    else if (isZeroDecimal(form.currency) && !Number.isInteger(price)) {
      e.unit_price = `${form.currency} has no decimals.`;
    }
    if (Object.keys(e).length) itemErrors[index] = e;
  });
  if (form.items.length === 0) errors.items_empty = "Add at least one item.";
  if (Object.keys(itemErrors).length) errors.items = itemErrors;
  return errors;
}

// Form state -> InvoiceCreate payload. No total here: the server calculates it.
export function toPayload(form, chatText) {
  return {
    client_name: form.client_name.trim(),
    client_email: form.client_email.trim() || null,
    currency: form.currency,
    due_date: form.due_date,
    notes: form.notes.trim() || null,
    source_chat: chatText || null,
    items: form.items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    })),
  };
}
