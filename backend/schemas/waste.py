"""
schemas/waste.py — Pydantic schemas for waste-related API request/response bodies.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class WasteRecordCreate(BaseModel):
    waste_category: str
    quantity: float
    unit: str = "kg"
    disposal_method: Optional[str] = None
    location_id: Optional[int] = None
    notes: Optional[str] = None


class WasteRecordOut(BaseModel):
    id: int
    waste_category: str
    quantity: float
    unit: str
    disposal_method: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WasteCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    disposal_method: Optional[str]
    color_hex: Optional[str]

    class Config:
        from_attributes = True
