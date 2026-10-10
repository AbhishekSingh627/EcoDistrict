"""
services/seed.py — Seeds the database with initial waste categories.
Run once: python -m services.seed
"""

from database import SessionLocal, engine, Base
import models


WASTE_CATEGORIES = [
    {
        "name": "Plastic",
        "description": "PET bottles, plastic bags, packaging",
        "disposal_method": "Dry recycling bin — clean and dry before disposing",
        "color_hex": "#3b82f6",
    },
    {
        "name": "Paper",
        "description": "Newspapers, cardboard, office paper",
        "disposal_method": "Paper recycling bin — keep dry, remove staples",
        "color_hex": "#f59e0b",
    },
    {
        "name": "Glass",
        "description": "Bottles, jars, broken glass",
        "disposal_method": "Glass recycling point — wrap broken glass safely",
        "color_hex": "#06b6d4",
    },
    {
        "name": "Metal",
        "description": "Cans, tins, scrap metal",
        "disposal_method": "Dry recycling bin — rinse food containers",
        "color_hex": "#6b7280",
    },
    {
        "name": "Organic",
        "description": "Food scraps, garden waste, biodegradables",
        "disposal_method": "Compost bin or wet waste collection point",
        "color_hex": "#22c55e",
    },
    {
        "name": "E-waste",
        "description": "Old electronics, batteries, cables",
        "disposal_method": "Designated e-waste collection point only — never in general bins",
        "color_hex": "#a855f7",
    },
    {
        "name": "Textile",
        "description": "Old clothes, fabric, footwear",
        "disposal_method": "Textile donation point or textile recycling drop-off",
        "color_hex": "#ec4899",
    },
    {
        "name": "Other",
        "description": "Hazardous waste, mixed waste, unclassified",
        "disposal_method": "Contact local waste authority for guidance",
        "color_hex": "#ef4444",
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(models.WasteCategory).count()
        if existing > 0:
            print(f"Database already has {existing} categories — skipping seed.")
            return
        for cat in WASTE_CATEGORIES:
            db.add(models.WasteCategory(**cat))
        db.commit()
        print(f"Seeded {len(WASTE_CATEGORIES)} waste categories.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
