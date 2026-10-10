"""
main.py — EcoDistrict FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 — ensures models are registered before create_all
from routes import waste, locations, analytics, ai, verify, nearby
from services.seed import seed

# ── Create tables on startup ──────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
seed()  # no-op if categories already exist

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="EcoDistrict API",
    description="Intelligent District Waste Management Platform — Phase 1",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS — allow the Vite dev server ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(waste.router,     prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(ai.router,        prefix="/api")
app.include_router(verify.router,    prefix="/api")
app.include_router(nearby.router,    prefix="/api")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["system"])
def health():
    """Simple liveness probe."""
    return {"status": "ok", "service": "EcoDistrict API"}


@app.get("/", tags=["system"])
def root():
    return {"message": "EcoDistrict API is running. Visit /api/docs for interactive documentation."}
