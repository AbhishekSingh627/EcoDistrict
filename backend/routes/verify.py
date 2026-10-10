"""
routes/verify.py — Dataset-curation image verification endpoint.

POST /api/ai/verify-image

PURPOSE:
  Uses Google Gemini as a dataset-curation ASSISTANT to evaluate whether
  an uploaded image is a suitable labelled candidate for the EcoDistrict
  waste-classification dataset.

  This endpoint does NOT replace the primary EcoDistrict TFLite classifier.
  POST /api/ai/classify remains the project's production inference endpoint.
  Results from this endpoint must be human-reviewed before use.

REQUIRED ENVIRONMENT VARIABLE:
  GEMINI_API_KEY  (set in backend/.env — never commit to version control)
"""

import io

from fastapi import APIRouter, File, HTTPException, UploadFile

from schemas.image_verify import ImageVerifyResponse
from services.gemini_verify import verify_image


router = APIRouter(prefix="/ai", tags=["ai"])

# Accepted MIME types — covers common phone/screenshot formats
_ALLOWED_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp", "image/gif")


@router.post("/verify-image", response_model=ImageVerifyResponse)
async def verify_waste_image(file: UploadFile = File(...)):
    """
    Dataset-curation verification via Google Gemini.

    Accepts a multipart image upload and asks Gemini:
    - Does this image contain a recognisable waste item?
    - Which EcoDistrict category does it belong to (if any)?
    - Is it suitable as a real-world validation/training candidate?

    Returns structured JSON validated against the ImageVerifyResponse schema.

    **This is a human-review assistant — not a production classifier.**
    The EcoDistrict TFLite model (POST /api/ai/classify) remains the
    primary classifier and is not affected by this endpoint.
    """

    # ── Validate content type ─────────────────────────────────────────────────
    if not file.content_type or not any(
        file.content_type.startswith(p) for p in _ALLOWED_MIME_PREFIXES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload a valid image file "
                "(JPEG, PNG, WebP, or GIF)."
            ),
        )

    # ── Read image bytes (not stored permanently) ─────────────────────────────
    try:
        image_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read uploaded file: {exc}",
        )

    # ── Call Gemini verification service ─────────────────────────────────────
    try:
        result = verify_image(image_bytes, file.content_type)
    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned an unexpected response: {exc}",
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error: {exc}",
        )

    return result
