from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.config import settings
from app.routers import agent, clients, demo, extract, invoices, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts
    try:
        db.init_indexes()
    except Exception as exc:
        print(f"WARNING: could not create database indexes: {exc}")
    yield


app = FastAPI(title="InvoiceChat", lifespan=lifespan)

# Lets the React app (running on another address) call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router)
app.include_router(invoices.router)
app.include_router(webhooks.router)
app.include_router(clients.router)
app.include_router(agent.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    db.client.admin.command("ping")
    return {"status": "ok", "database": "connected", "payment_provider": settings.payment_provider}