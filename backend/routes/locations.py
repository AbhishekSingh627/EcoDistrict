"""
routes/locations.py — API routes for waste/recycling disposal locations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
from schemas.location import LocationCreate, LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/", response_model=List[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    """Return all registered waste disposal / recycling locations."""
    return db.query(models.Location).all()


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.post("/", response_model=LocationOut, status_code=201)
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    """Add a new disposal/recycling location (admin use — auth added in Phase 2)."""
    loc = models.Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc
