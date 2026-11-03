import { api } from "@/api/client";

// One small function per backend endpoint, so pages never build URLs themselves.

export async function extractInvoice(chatText, language) {
  const { data } = await api.post("/api/extract", { chat_text: chatText, language });
  return data; // { invoice, warnings, autofilled }
}

export async function createInvoice(payload) {
  const { data } = await api.post("/api/invoices", payload);
  return data; // saved invoice, including the server-calculated total
}

export async function deleteInvoice(id) {
  const { data } = await api.delete(`/api/invoices/${id}`);
  return data;
}

export async function sendInvoice(id) {
  const { data } = await api.post(`/api/invoices/${id}/send`);
  return data; // invoice with status SENT and payment_url
}

export async function searchClients(q) {
  const { data } = await api.get("/api/clients", { params: { q } });
  return data; // [{ id, name, email, invoice_count }]
}
