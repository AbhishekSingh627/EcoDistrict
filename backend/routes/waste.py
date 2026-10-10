"""
routes/waste.py — API routes for waste records and categories.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
from schemas.waste import WasteRecordCreate, WasteRecordOut, WasteCategoryOut

router = APIRouter(prefix="/waste", tags=["waste"])


@router.get("/categories", response_model=List[WasteCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """Return all waste categories."""
    return db.query(models.WasteCategory).all()


@router.get("/records", response_model=List[WasteRecordOut])
def list_records(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Return recent waste records (public endpoint — auth added in Phase 2)."""
    return (
        db.query(models.WasteRecord)
        .order_by(models.WasteRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/records", response_model=WasteRecordOut, status_code=201)
def create_record(payload: WasteRecordCreate, db: Session = Depends(get_db)):
    """Log a new waste record."""
    record = models.WasteRecord(
        # user_id will be taken from auth token in Phase 2; hardcode 0 for now
        user_id=0,
        **payload.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/records/{record_id}", response_model=WasteRecordOut)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.WasteRecord).filter(models.WasteRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record
