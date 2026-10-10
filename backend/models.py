"""
models.py — SQLAlchemy ORM models (database table definitions).
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    """
    Basic user record. Authentication will be added in a later phase.
    For now this holds enough to associate waste records with an identity.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    waste_records = relationship("WasteRecord", back_populates="user")


class WasteCategory(Base):
    """
    Lookup table for waste categories (Plastic, Paper, Glass, etc.).
    Populated by a seed script; not user-editable via the public API.
    """
    __tablename__ = "waste_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(60), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    disposal_method = Column(String(200), nullable=True)
    color_hex = Column(String(7), nullable=True)   # e.g. "#22c55e"

    waste_records = relationship("WasteRecord", back_populates="category")


class WasteRecord(Base):
    """
    A single waste-disposal event logged by a user.
    """
    __tablename__ = "waste_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("waste_categories.id"), nullable=True)

    # Convenience denormalized field so records survive category renames
    waste_category = Column(String(60), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String(20), nullable=False, default="kg")  # kg | litres | items
    disposal_method = Column(String(100), nullable=True)

    # Optional: which location was used for disposal
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="waste_records")
    category = relationship("WasteCategory", back_populates="waste_records")
    location = relationship("Location")


class Location(Base):
    """
    A physical waste-disposal or recycling point.
    Geographic coordinates allow map display via React Leaflet.
    """
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    location_type = Column(String(60), nullable=False)  # e.g. "Recycling Point"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(300), nullable=True)
    description = Column(Text, nullable=True)

    # Comma-separated list of accepted waste types, e.g. "Plastic,Paper,Glass"
    accepted_waste = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=utcnow)
