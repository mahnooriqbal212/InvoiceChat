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

export async function listInvoices() {
  const { data } = await api.get("/api/invoices");
  return data; // newest first, each with display_status (DRAFT, PENDING, OVERDUE, PAID, CANCELLED)
}

export async function seedDemo() {
  const { data } = await api.post("/api/demo/seed");
  return data; // { created }
}

export async function clearDemo() {
  const { data } = await api.delete("/api/demo");
  return data; // { deleted }
}

export async function deleteInvoice(id) {
  const { data } = await api.delete(`/api/invoices/${id}`);
  return data;
}

export async function sendInvoice(id) {
  const { data } = await api.post(`/api/invoices/${id}/send`);
  return data; // invoice with status SENT and payment_url
}

// ---------- The client's pay page ----------

export async function getPayInvoice(id) {
  const { data } = await api.get(`/api/pay/${id}`);
  return data; // public invoice details, plus checkout_mode: "braintree", "test" or "paypal"
}

export async function createClientToken(id) {
  const { data } = await api.post(`/api/pay/${id}/client-token`);
  return data.client_token;
}

// body is { nonce } from the payment form, or { simulated_paypal: true }
export async function payInvoice(id, body) {
  const { data } = await api.post(`/api/pay/${id}`, body);
  return data; // the updated public invoice
}

export async function simulatePayment(id) {
  const { data } = await api.post(`/api/dev/simulate-payment/${id}`);
  return data;
}

export async function searchClients(q) {
  const { data } = await api.get("/api/clients", { params: { q } });
  return data; // [{ id, name, email, invoice_count }]
}
