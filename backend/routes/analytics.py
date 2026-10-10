"""
routes/analytics.py — Placeholder analytics endpoints.
Will be replaced with real aggregation queries in Phase 2.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def analytics_summary():
    """
    District-level summary statistics.
    NOTE: These are placeholder values — real aggregation will be added in Phase 2
    once the database has sufficient real records.
    """
    return {
        "note": "placeholder — real aggregation coming in Phase 2",
        "total_waste_kg": 0,
        "recycled_kg": 0,
        "recycling_rate_percent": 0,
        "segregation_rate_percent": 0,
        "total_records": 0,
    }


@router.get("/monthly")
def monthly_trend():
    """Monthly waste totals — placeholder response."""
    return {
        "note": "placeholder — real monthly trend coming in Phase 2",
        "months": [],
    }
