"""
schemas/image_verify.py — Pydantic schema for the Gemini dataset-curation response.

This schema is used ONLY by the /api/ai/verify-image endpoint.
It does NOT affect the primary EcoDistrict TFLite classifier.
"""

from typing import Literal, Optional
from pydantic import BaseModel


# The 10 EcoDistrict waste categories — must match class_names.json exactly.
ECODISTRICT_CATEGORIES = Literal[
    "battery",
    "biological",
    "cardboard",
    "clothes",
    "glass",
    "metal",
    "paper",
    "plastic",
    "shoes",
    "trash",
]


class ImageVerifyResponse(BaseModel):
    """
    Structured response returned by the Gemini dataset-curation verification.

    NOTE: This is a dataset-curation assistant result. It must be
    human-reviewed before any image is added to the EcoDistrict dataset.
    The EcoDistrict MobileNetV2 TFLite model remains the primary classifier.
    """

    is_waste: bool
    category: Optional[ECODISTRICT_CATEGORIES]
    confidence: Literal["high", "medium", "low"]
    usable_for_dataset: bool
    reason: str


class GeminiVerification(BaseModel):
    """
    Gemini's optional verification result attached to a scan response.
    This is a dataset-curation ASSISTANT result — never the primary prediction.
    The TFLite model prediction in CombinedScanResponse.model_category is always
    the authoritative classification shown to the user.
    """
    is_waste: bool
    category: Optional[ECODISTRICT_CATEGORIES]
    confidence: Literal["high", "medium", "low"]
    agrees_with_model: bool          # True when category matches model_category
    reason: str


class CombinedScanResponse(BaseModel):
    """
    Response from POST /api/ai/scan.

    primary_source tells the frontend which category to display:
      "gemini" — Gemini returned is_waste=True and a valid category; use gemini.category.
      "model"  — Gemini was absent, failed, or returned is_waste=False; use model_category.

    The TFLite model result is always present for debugging and future training.
    The Gemini API key is never returned to the frontend.
    """
    # ── TFLite model result (always present) ──────────────────────────────────
    status: str                       # "success"
    filename: Optional[str]
    model_category: str               # TFLite prediction (keep for debugging/training)
    model_confidence: float           # 0-100
    top_predictions: list             # [{category, confidence}]
    model: str                        # model identifier string

    # ── Which source to display ───────────────────────────────────────────────
    primary_source: Literal["gemini", "model"]  # "gemini" when Gemini succeeded

    # ── Gemini result (optional) ──────────────────────────────────────────────
    gemini: Optional[GeminiVerification] = None
    gemini_error: Optional[str] = None   # set when Gemini failed; never shown raw to users
