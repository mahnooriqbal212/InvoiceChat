# InvoiceChat

**Turn a messy client chat into a paid invoice.** InvoiceChat is an AI invoicing assistant for freelancers. Paste a conversation from WhatsApp, email or Slack, check what the AI found, and send your client a secure payment link. A live dashboard shows what's paid, pending and overdue, and a collections agent drafts polite reminders for you to approve.

Built for the PayPal AI Hackathon 2026.

> **Live demo:** _coming soon_ · **Demo video:** _coming soon_

---

## The problem

Freelancers agree on work in chat: "logo for $150, two banners at $40 each, pay by Friday". Turning that into an invoice means retyping names, prices and dates, then chasing late payers. InvoiceChat does the boring parts and keeps you in control.

## What it does

1. **Paste a chat.** AI (Groq, `openai/gpt-oss-120b`) extracts the client, line items, currency and due date, including relative dates like "next Friday".
2. **Review and edit.** Nothing is saved until you check it. Warnings point out anything the AI wasn't sure about. Saved clients autocomplete, and a missing email is filled in from past invoices.
3. **Send a payment link.** The server calculates the total (never the AI) and creates the invoice through the payment provider.
4. **Get paid.** The client opens a clean pay page with no login.
5. **Watch it live.** The dashboard refreshes every 4 seconds. When a client pays, the row turns green and you get a "Sara Khan paid $230.00" notification.
6. **Collect overdue money.** The collections agent finds overdue invoices and drafts a reminder in the right tone (friendly, firm or final, depending on how late the invoice is). **It never sends anything by itself**: you approve every message.

### Highlights

- **21 currencies** from PayPal's supported list. JPY, HUF and TWD are shown without decimals. Amounts in different currencies are **never added together**.
- **Overdue is calculated, not stored.** An invoice is overdue when it has been sent, the due date has passed, and it isn't paid.
- **Dashboard built with AG Grid:** sortable columns, pagination, custom status badges, cells that flash on live changes, and one-click **CSV export**. The grid theme uses the app's own colours in light and dark mode.
- **Works on phones.** On small screens the grid becomes tappable invoice cards.
- **Safe AI.** Chat text is treated as data (a prompt-injection guard), extraction runs at temperature 0 in JSON mode and is checked against a strict model, and the AI retries once with its validation error when its first answer is invalid.
- **Validated twice.** The review form checks every field instantly, and the server checks the same rules again (for example, the client email's format), so nothing invalid is saved or sent to a payment provider, even through the API.
- **Safe payments.** The amount always comes from the database. A 2-minute lock prevents double charges, and payment webhooks are signature-verified and processed only once.

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

## Tech stack

| Part | Tools |
|---|---|
| Backend | Python, FastAPI, Pydantic v2, PyMongo, MongoDB Atlas, httpx, Groq SDK, Braintree SDK |
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui (Radix), AG Grid Community, TanStack Query, axios, sonner |
| Hosting | Render (backend), Vercel (frontend) |

```
backend/app/
  main.py            FastAPI app, CORS, routers, dark /docs page
  routers/           extract, invoices, pay, webhooks, clients, agent, demo
  services/          ai.py (Groq), payments.py (provider switch), paypal.py, braintree_provider.py
frontend/src/
  pages/             PasteChat, Dashboard, AgentQueue, PayInvoice
  components/        invoice/ (new-invoice flow), dashboard/ (cards, grid, details), pay/, ui/ (shadcn)
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
