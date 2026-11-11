// Everything the UI needs to show an invoice status.
// The server sends `display_status`: DRAFT, PENDING, OVERDUE, PAID or CANCELLED
// (OVERDUE is never stored; the server works it out from the due date).

export const STATUS = {
  PAID: { label: "Paid", badge: "bg-success/12 text-success ring-success/25", dot: "bg-success" },
  PENDING: { label: "Pending", badge: "bg-warning/12 text-warning ring-warning/25", dot: "bg-warning" },
  OVERDUE: { label: "Overdue", badge: "bg-destructive/10 text-destructive ring-destructive/25", dot: "bg-destructive" },
  DRAFT: { label: "Draft", badge: "bg-muted text-muted-foreground ring-foreground/10", dot: "bg-muted-foreground" },
  CANCELLED: { label: "Cancelled", badge: "bg-muted text-muted-foreground ring-foreground/10 line-through", dot: "bg-muted-foreground" },
};

// Used for sorting the Status column in a sensible order
export const STATUS_ORDER = ["OVERDUE", "PENDING", "DRAFT", "PAID", "CANCELLED"];

// Today as "YYYY-MM-DD" in the user's own time zone
export function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

// Whole days between two "YYYY-MM-DD" dates (b - a)
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// A short, friendly line about the due date: "Due in 6 days", "9 days overdue", "Due today"
// Whether it is overdue comes from the server (display_status), never from the browser's clock.
// The server (Render, UTC) and a browser in Pakistan (UTC+5) can be on different dates for a
// few hours each night; the browser's clock is only used to count the days.
export function dueHint(invoice) {
  const status = invoice.display_status;
  if (!invoice.due_date || status === "PAID" || status === "CANCELLED") return null;
  const days = daysBetween(todayIso(), invoice.due_date);
  if (status === "OVERDUE") {
    const late = daysOverdue(invoice);
    return { text: `${late} day${late === 1 ? "" : "s"} overdue`, tone: "text-destructive" };
  }
  // Not overdue on the server, but the browser is already on the next day: still "today"
  if (days <= 0) return { text: "Due today", tone: "text-warning" };
  if (days === 1) return { text: "Due tomorrow", tone: "text-warning" };
  return { text: `Due in ${days} days`, tone: "text-muted-foreground" };
}

// How many days an OVERDUE invoice is late (at least 1). 0 for any other status.
export function daysOverdue(invoice) {
  if (invoice.display_status !== "OVERDUE" || !invoice.due_date) return 0;
  return Math.max(1, -daysBetween(todayIso(), invoice.due_date));
}

// "Bakery logo design" or "Bakery logo design +1 more"
export function itemsSummary(items = []) {
  if (items.length === 0) return "";
  const first = items[0].description;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

// "Nov 8, 2026" from a full ISO timestamp
export function formatTimestamp(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
