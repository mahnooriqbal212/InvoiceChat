from pymongo import MongoClient
from app.config import settings

client = MongoClient(settings.mongodb_uri)
db = client[settings.mongodb_db_name]

invoices = db["invoices"]
webhook_events = db["webhook_events"]