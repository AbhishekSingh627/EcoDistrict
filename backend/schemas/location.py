"""
schemas/location.py — Pydantic schemas for location API request/response bodies.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LocationCreate(BaseModel):
    name: str
    location_type: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    description: Optional[str] = None
    accepted_waste: Optional[str] = None


class LocationOut(BaseModel):
    id: int
    name: str
    location_type: str
    latitude: float
    longitude: float
    address: Optional[str]
    description: Optional[str]
    accepted_waste: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
