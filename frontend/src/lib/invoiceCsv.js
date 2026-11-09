import { isZeroDecimal } from "@/lib/money";
import { STATUS, todayIso } from "@/lib/invoiceStatus";

// The columns of the CSV file. The AG Grid table uses this same list (as hidden columns),
// so the file is identical whether it is exported from the grid or from the phone view.
export const EXPORT_COLUMNS = [
  { id: "csv_id", header: "Invoice ID", value: (i) => i.id },
  { id: "csv_client", header: "Client", value: (i) => i.client_name },
  { id: "csv_email", header: "Client email", value: (i) => i.client_email ?? "" },
  { id: "csv_items", header: "Items", value: (i) => (i.items ?? []).map((it) => `${it.description} x${it.quantity}`).join("; ") },
  { id: "csv_currency", header: "Currency", value: (i) => i.currency },
  // A plain number (no currency sign), so spreadsheets can do maths with it
  { id: "csv_amount", header: "Amount", value: (i) => Number(i.total).toFixed(isZeroDecimal(i.currency) ? 0 : 2) },
  { id: "csv_status", header: "Status", value: (i) => STATUS[i.display_status]?.label ?? i.display_status },
  { id: "csv_due", header: "Due date", value: (i) => i.due_date ?? "" },
  { id: "csv_created", header: "Created", value: (i) => (i.created_at ?? "").slice(0, 10) },
  { id: "csv_paid", header: "Paid on", value: (i) => (i.paid_at ?? "").slice(0, 10) },
  { id: "csv_method", header: "Payment method", value: (i) => i.payment_method ?? "" },
  { id: "csv_link", header: "Payment link", value: (i) => i.payment_url ?? "" },
  { id: "csv_sample", header: "Sample data", value: (i) => (i.is_demo ? "yes" : "no") },
];

export function csvFileName() {
  return `invoicechat-invoices-${todayIso()}.csv`;
}

// Used on phones, where the AG Grid table is not on screen
export function downloadCsv(invoices) {
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    EXPORT_COLUMNS.map((c) => quote(c.header)).join(","),
    ...invoices.map((invoice) => EXPORT_COLUMNS.map((c) => quote(c.value(invoice))).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName();
  link.click();
  URL.revokeObjectURL(url);
}
