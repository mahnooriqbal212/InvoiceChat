# InvoiceChat

**Turn a messy client chat into a paid invoice.** InvoiceChat is an AI invoicing assistant for freelancers. Paste a conversation from WhatsApp, email or Slack, check what the AI found, and send your client a secure payment link. A live dashboard shows what's paid, pending and overdue, and a collections agent drafts polite reminders for you to approve.

Built for the PayPal AI Hackathon 2026.

> **Live demo:** <https://invoice-chat-omega.vercel.app> · **API docs:** <https://invoicechat-api.onrender.com/docs> · **Demo video:** _coming soon_
>
> The backend runs on Render's free plan and sleeps when nobody uses it, so the first page load can take about a minute. After that it is fast.

## Try it in 2 minutes

1. Open the [live demo](https://invoice-chat-omega.vercel.app) and go to **Dashboard → Sample data → Load sample data**. You get paid, pending, overdue and draft invoices in several currencies.
2. Go to **New invoice**, paste a chat such as *"Hi! Can you invoice me for 4 hours of website fixes at $100/hour? Due November 30. My email is client@example.com"*, then click **Extract invoice**, check the fields, click **Save and review total**, then **Send invoice**.
3. Open the payment link. The live demo uses the **PayPal sandbox**: pay with a PayPal sandbox buyer account, and the dashboard turns the invoice **Paid** a few seconds later (through a signature-verified PayPal webhook). Sample invoices have a clearly labelled **"Simulate payment (test)"** button instead.
4. On the **Dashboard**, try the filters under each column, tick a few rows, and click **Draft reminders**. Then open **Agent queue** to review, edit and approve the AI drafts.

---

## The problem

Freelancers agree on work in chat: "logo for $150, two banners at $40 each, pay by Friday". Turning that into an invoice means retyping names, prices and dates, then chasing late payers. InvoiceChat does the boring parts and keeps you in control.

## What it does

1. **Paste a chat.** AI (Groq, `openai/gpt-oss-120b`) extracts the client, line items, currency and due date, including relative dates like "next Friday".
2. **Review and edit.** Nothing is saved until you check it. Warnings point out anything the AI wasn't sure about. Saved clients autocomplete, and a missing email is filled in from past invoices.
3. **Send a payment link.** The server calculates the total (never the AI) and creates the invoice through the payment provider.
4. **Get paid.** The client opens a clean pay page with no login.
5. **Watch it live.** The dashboard refreshes every 4 seconds. When a client pays, the row turns green, the totals update and you get a "Sara Khan paid $230.00" notification.
6. **Collect overdue money.** On the **Agent queue** page, the collections agent finds overdue invoices and drafts a reminder in the right tone (friendly, firm or final, depending on how late the invoice is) and explains its choice. You decide the **tone rules**: from which day overdue each tone starts (by default friendly from day 1, firm from day 4, final from day 15), with checks that keep them in order. You can switch the tone (the AI rewrites the message), edit it, copy it or open it in your email app, then approve or dismiss it. **It never sends anything by itself**: every message waits for your approval. To protect the free AI quota without a login, the agent can run once a minute.

### Highlights

- **21 currencies** from PayPal's supported list. JPY, HUF and TWD are shown without decimals. Amounts in different currencies are **never added together**.
- **Overdue is calculated, not stored.** An invoice is overdue when it has been sent, the due date has passed, and it isn't paid.
- **A real data grid (AG Grid)** for the dashboard, with filters, live totals per currency and bulk AI actions. See [the dashboard section](#the-dashboard-ag-grid) below.
- **Works on phones.** On small screens the grid becomes tappable invoice cards.
- **Safe AI.** Chat text is treated as data (a prompt-injection guard), extraction runs at temperature 0 in JSON mode and is checked against a strict model, and the AI retries once with its validation error when its first answer is invalid.
- **Validated twice.** The review form checks every field instantly, and the server checks the same rules again (for example, the client email's format), so nothing invalid is saved or sent to a payment provider, even through the API.
- **Safe payments.** The amount always comes from the database. A 2-minute lock prevents double charges, and payment webhooks are signature-verified and processed only once.

## The dashboard (AG Grid)

The invoice table is built with **AG Grid Community** (free features only) and is connected to the rest of the app:

| Feature | What you can do |
|---|---|
| **Three kinds of filters working together** | The status tabs (All, Pending, Overdue, Paid, Drafts) are an AG Grid *external filter*, the search box is its *quick filter* (it searches client, email, currency and every item), and each column has its own filter under the header: text for Client and Items, "500 or more" for Amount, a date picker for Due. Example: unpaid invoices over $500 due this month. |
| **Live totals rows, one per currency** | Pinned rows at the bottom add up the invoices you can see, and they change as you filter. Different currencies get their own row and are never added together. Cancelled invoices are not counted. |
| **Row selection and bulk actions** | Tick rows (or tick the header box for every filtered row), then **Export selected** to CSV or **Draft reminders**: the AI writes a reminder for each selected overdue invoice in the tone your tone rules give. Drafts wait in the Agent queue for approval, and nothing is sent. |
| **Coloured rows** | Overdue rows get a soft red tint and edge, paid rows a soft green one. |
| **Tooltips** | Hover over the Items cell to see every item with quantity, price and line total. |
| **Keyboard** | Arrow keys move between cells, Enter opens the invoice details, and Space ticks a row. |
| **Live updates** | Rows update in place every 4 seconds (row IDs), and the Amount and Status cells flash when they change, for example when a payment arrives. |
| **CSV export** | Exports exactly what the filters show (or only the ticked rows), using 13 clean columns that the screen doesn't show. |
| **Theme** | `themeQuartz.withParams` uses the app's own colour variables, so the grid, filter menus and checkboxes follow light and dark mode. |

Also: sorting on every column (Status sorts Overdue first), column resizing, pagination (10/25/50), custom cell renderers and a custom "nothing found" message. On phones the grid becomes tappable cards.

## Payments: PayPal and Braintree

InvoiceChat supports three payment providers, chosen with one setting (`PAYMENT_PROVIDER`):

| Provider | What happens |
|---|---|
| `paypal` | Uses the **PayPal Invoicing v2 API (sandbox)**: create → send → PayPal's own pay page. **PayPal webhooks** (signature-verified) mark invoices paid or cancelled. |
| `braintree` | Uses **Braintree (a PayPal service), sandbox only**. InvoiceChat hosts the pay page with Braintree's Drop-in card form, and Braintree's reply marks the invoice paid. Each currency maps to its own Braintree merchant account; an unmapped currency stays a draft with a clear error, and amounts are never converted. |
| `fake` | For local development: test links and a clearly labelled **"Simulate payment (test)"** button. |

**Switching providers is safe.** Each invoice remembers which provider sent it and is always paid through that provider. If you switch `PAYMENT_PROVIDER`, invoices that are still unpaid keep working: a Braintree invoice keeps its Braintree card form, and a PayPal invoice keeps its PayPal link and webhooks. Keep both sets of keys configured for this. Sample invoices never contact PayPal or Braintree.

**About simulated payments:** anything simulated is always labelled as simulated on screen. This covers the test button and Braintree's "Pay with PayPal (simulated)" button (on only when `BRAINTREE_SIMULATED_PAYPAL=true`). No real money moves in any mode; all providers run in sandbox.

**Why both?** PayPal Developer accounts can't be created from Pakistan, where the developer lives. Braintree was the first fallback; the PayPal sandbox integration is set up with a teammate's account in a supported country.

## How InvoiceChat uses PayPal, AI and sponsor tools

| Tool | What it does in InvoiceChat |
|---|---|
| **PayPal Invoicing API v2** (sandbox) | Creates and sends the invoice, then reads PayPal's payer link. The client pays on PayPal's own invoice page. |
| **PayPal OAuth 2.0** | Gets the access token for every PayPal call (cached until it expires). |
| **PayPal Webhooks + Verify Webhook Signature API** | Payment and cancel events are signature-checked, stored once (unique event ID) and turn the invoice **Paid** on the live dashboard. |
| **PayPal invoice reminders** | When you approve a reminder for a PayPal invoice, PayPal sends its reminder to the client. |
| **Braintree** (a PayPal service, sandbox) | Optional provider: InvoiceChat's own pay page with the Braintree Drop-in card form, one merchant account per currency. |
| **Groq API, model `openai/gpt-oss-120b`** (AI) | 1) Reads a pasted chat and returns the client, items, currency and due date as checked JSON. 2) Writes payment reminders in a friendly, firm or final tone for the collections agent. The AI never calculates totals and never sends anything by itself. |
| **AG Grid Community** (sponsor) | The dashboard grid: filters, live per-currency totals, row selection with bulk AI reminder drafts, CSV export. |
| **Render** (sponsor) | Hosts the FastAPI backend (free web service) and receives the PayPal webhooks. |

The frontend is hosted on Vercel. This project was built with help from Claude Code (an AI coding assistant).

## Tech stack

| Part | Tools |
|---|---|
| Backend | Python, FastAPI, Pydantic v2, PyMongo, MongoDB Atlas, httpx, Groq SDK, Braintree SDK |
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui (Radix), AG Grid Community, TanStack Query, axios, sonner |
| Hosting | Render (backend, free web service), Vercel (frontend) |

```
backend/app/
  main.py            FastAPI app, CORS, routers, dark /docs page
  routers/           extract, invoices, pay, webhooks, clients, agent, demo
  services/          ai.py (Groq), payments.py (provider switch), paypal.py, braintree_provider.py
frontend/src/
  pages/             PasteChat, Dashboard, AgentQueue, PayInvoice
  components/        invoice/ (new-invoice flow), dashboard/ (cards, AG Grid, selection bar, details),
                     agent/ (reminder cards, tone rules), pay/, ui/ (shadcn)
  api/               one function per backend endpoint
```

## Run it locally

You need Python 3.12+, Node 20+, a free [MongoDB Atlas](https://www.mongodb.com/atlas) database and a free [Groq](https://console.groq.com) API key.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
# Fill in MONGODB_URI and GROQ_API_KEY. Set PAYMENT_PROVIDER=fake to try it without payment keys.
uvicorn app.main:app --reload
```

The API docs are at <http://localhost:8000/docs>.

### Frontend

```bash
cd frontend
npm install
# Optional: create frontend/.env with VITE_API_URL=http://localhost:8000 (that is also the default)
npm run dev
```

`npm audit` warnings come from development tools (ESLint, shadcn CLI) and do not affect the built app.

Open <http://localhost:5173>. On the **Dashboard**, click **Sample data → Load sample data** to fill the app with example invoices. Sample invoices are marked "Sample" and can be removed at any time without touching real ones.

### Environment variables (backend)

| Variable | Needed for |
|---|---|
| `MONGODB_URI`, `MONGODB_DB_NAME` | Always |
| `GROQ_API_KEY`, `GROQ_MODEL` | Always (default model `openai/gpt-oss-120b`) |
| `PAYMENT_PROVIDER` | `fake`, `braintree` or `paypal` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_WEBHOOK_ID` | PayPal mode |
| `BRAINTREE_MERCHANT_ID`, `BRAINTREE_PUBLIC_KEY`, `BRAINTREE_PRIVATE_KEY`, `BRAINTREE_MERCHANT_ACCOUNTS`, `BRAINTREE_SIMULATED_PAYPAL` | Braintree mode |
| `FRONTEND_URL`, `CORS_ORIGINS` | The frontend's address (pay links and CORS) |

See [`backend/.env.example`](backend/.env.example). Never commit your real `.env`.

### Test payments (sandbox)

- Braintree test card: `4111 1111 1111 1111`, any future expiry date such as `12/30`.
- In the Braintree sandbox, amounts from **2000.00 to 2999.99** are declined on purpose, to test failed payments.
- PayPal: pay with a PayPal **sandbox personal (buyer) account**.

## License

[MIT](LICENSE)
