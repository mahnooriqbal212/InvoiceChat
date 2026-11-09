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

// ---------- Collections agent and reminders ----------

export async function runAgent() {
  const { data } = await api.post("/api/agent/run");
  return data; // { checked, drafted: [...], skipped: [...], errors: [...] }
}

export async function getAgentStatus() {
  const { data } = await api.get("/api/agent/status");
  return data; // { last_run_at, last_result, cooldown_seconds, max_per_run }
}

export async function getAgentQueue() {
  const { data } = await api.get("/api/agent/queue");
  return data; // invoices whose reminder draft waits for approval
}

export async function draftReminder(id, tone) {
  const { data } = await api.post(`/api/invoices/${id}/reminder-draft`, null, { params: { tone } });
  return data; // { reminder_draft, tone, days_overdue, agent_note }
}

export async function dismissReminder(id) {
  const { data } = await api.delete(`/api/invoices/${id}/reminder-draft`);
  return data;
}

// The freelancer approves the (possibly edited) message. Nothing is emailed by InvoiceChat itself.
export async function sendReminder(id, text) {
  const { data } = await api.post(`/api/invoices/${id}/reminder/send`, { text });
  return data;
}

export async function getToneDays() {
  const { data } = await api.get("/api/agent/tone-days");
  return data; // { friendly, firm, final, defaults: { friendly, firm, final } }
}

export async function saveToneDays(rules) {
  const { data } = await api.put("/api/agent/tone-days", rules);
  return data;
}
