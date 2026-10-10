"""
database.py — SQLAlchemy database connection and session setup.
Uses SQLite for local development. Swap DATABASE_URL in .env to migrate later.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Default to a local SQLite file; override via DATABASE_URL in .env
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ecodistrict.db")

engine = create_engine(
    DATABASE_URL,
    # SQLite-specific: allow the same connection in multiple threads
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a database session and closes it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
