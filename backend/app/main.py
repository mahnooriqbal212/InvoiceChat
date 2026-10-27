from fastapi import FastAPI
from app.db import client

app = FastAPI(title="InvoiceChat")


@app.get("/api/health")
def health():
    client.admin.command("ping")
    return {"status": "ok", "database": "connected"}