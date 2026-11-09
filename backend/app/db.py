from pymongo import MongoClient
from app.config import settings

client = MongoClient(settings.mongodb_uri)  # sets up the connection to Atlas
db = client[settings.mongodb_db_name]

invoices = db["invoices"]
webhook_events = db["webhook_events"]
clients = db["clients"]
# One small document that remembers when the collections agent last ran (for the cooldown)
agent_state = db["agent_state"]


def init_indexes() -> None:
    """Create indexes. Safe to run every time the app starts."""
    invoices.create_index("created_at")
    invoices.create_index("paypal_invoice_id")
    # Unique index: the same PayPal event can never be saved twice
    webhook_events.create_index("event_id", unique=True)
    clients.create_index("key", unique=True)
 