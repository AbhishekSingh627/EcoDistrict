"""
routes/ai.py — EcoDistrict waste image classification endpoint.

Uses the trained EcoDistrict 10-class garbage TFLite model through LiteRT.
The model file is not committed to the repository; see README §ML Model for
how to obtain it.  If the file is absent the backend starts normally and
endpoints that require TFLite return HTTP 503 instead of crashing.
"""

from pathlib import Path
import io
import json
import logging

import numpy as np
from PIL import Image

from fastapi import APIRouter, UploadFile, File, HTTPException

from ai_edge_litert.interpreter import Interpreter
from schemas.image_verify import CombinedScanResponse, GeminiVerification
from services.gemini_verify import verify_image

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/ai", tags=["ai"])


# -------------------------------------------------------------------
# Model configuration
# -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "ml" / "models" / "ecodistrict_garbage_10class_v1.tflite"
CLASS_NAMES_PATH = BASE_DIR / "ml" / "models" / "class_names.json"

IMAGE_SIZE = (224, 224)


# Load class names
try:
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        CLASS_NAMES = json.load(f)
except Exception:
    CLASS_NAMES = [
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


# Load model once when the API starts.
# If the .tflite file is missing or corrupt the backend still starts;
# interpreter is set to None and _MODEL_LOAD_ERROR records why.
interpreter = None
INPUT_DETAILS = None
OUTPUT_DETAILS = None
_MODEL_LOAD_ERROR: str | None = None

try:
    interpreter = Interpreter(model_path=str(MODEL_PATH))
    interpreter.allocate_tensors()
    INPUT_DETAILS = interpreter.get_input_details()
    OUTPUT_DETAILS = interpreter.get_output_details()
except Exception as _exc:
    _MODEL_LOAD_ERROR = str(_exc)
    logger.warning(
        "TFLite model could not be loaded — local classifier is unavailable. "
        "Place the model at %s to enable it. Error: %s",
        MODEL_PATH,
        _exc,
    )


# -------------------------------------------------------------------
# Classification
# -------------------------------------------------------------------

@router.post("/classify")
async def classify_waste(file: UploadFile = File(...)):
    """
    Classify an uploaded waste image using the trained EcoDistrict model.
    Returns HTTP 503 if the TFLite model file is not available.
    """

    if interpreter is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local TFLite classifier is not available — model file missing. "
                "Use POST /api/ai/scan for Gemini-based classification."
            ),
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )

    try:
        image_bytes = await file.read()

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        image = image.resize(IMAGE_SIZE)

        image_array = np.asarray(image, dtype=np.float32)

        # V1 model preprocessing: raw pixel values 0-255 (no normalisation)
        image_array = np.expand_dims(image_array, axis=0)

        # Run inference
        interpreter.set_tensor(
            INPUT_DETAILS[0]["index"],
            image_array
        )

        interpreter.invoke()

        predictions = interpreter.get_tensor(
            OUTPUT_DETAILS[0]["index"]
        )[0]

        predicted_index = int(np.argmax(predictions))
        confidence = float(predictions[predicted_index])

        category = CLASS_NAMES[predicted_index]

        # Return top 3 predictions for transparency/debugging
        top_indices = np.argsort(predictions)[::-1][:3]

        top_predictions = [
            {
                "category": CLASS_NAMES[int(index)],
                "confidence": round(float(predictions[index]) * 100, 2),
            }
            for index in top_indices
        ]

        return {
            "status": "success",
            "filename": file.filename,
            "category": category,
            "confidence": round(confidence * 100, 2),
            "top_predictions": top_predictions,
            "model": "ecodistrict_garbage_10class_v1",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image classification failed: {str(e)}"
        )


# -------------------------------------------------------------------
# Categories
# -------------------------------------------------------------------

@router.get("/categories")
def ai_categories():
    """Return the categories supported by the trained model."""

    return {
        "categories": CLASS_NAMES,
        "model": "ecodistrict_garbage_10class_v1",
        "input_size": "224x224",
    }


# -------------------------------------------------------------------
# Combined scan: Gemini primary + TFLite fallback
# -------------------------------------------------------------------

# RuntimeError message prefixes emitted by gemini_verify.py
_GEMINI_QUOTA_PREFIXES  = ("quota_exhausted:", "rate_limited:")
_GEMINI_TIMEOUT_PREFIX  = "timeout:"
# Legacy keyword scan kept for any third-party wrapping
_GEMINI_QUOTA_KEYWORDS  = ("429", "quota", "rate", "resource_exhausted")
_MAX_GEMINI_SIZE_BYTES  = 10 * 1024 * 1024   # 10 MB — Gemini inline data limit


@router.post("/scan", response_model=CombinedScanResponse)
async def scan_and_verify(file: UploadFile = File(...)):
    """
    Classify a waste image.  Gemini is the primary classifier when available;
    the local TFLite model runs as a fallback and for training data when present.

    primary_source in the response tells the frontend which category to show:
      "gemini" — Gemini succeeded and returned a valid waste category.
      "model"  — Gemini was absent, failed, or said not-waste; use model_category.

    When the TFLite model file is missing:
      - Gemini (if configured) is tried first and can still return a full result.
      - If Gemini also fails or is absent, HTTP 503 is returned.

    The API key is never returned to the frontend.
    Preprocessing: raw float32 pixel values 0-255 (no normalisation).
    """

    # ── Validate content type ──────────────────────────────────────────────────
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file.",
        )

    # ── Read image bytes once; reuse for both TFLite and Gemini ───────────────
    try:
        image_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {exc}")

    # ── TFLite inference (skipped gracefully when model is unavailable) ────────
    model_category: str | None = None
    model_confidence: float | None = None
    top_predictions: list = []
    tflite_error: str | None = None

    if interpreter is None:
        # Model file was missing at startup — record why but do not crash.
        tflite_error = "model_unavailable"
        logger.debug("TFLite skipped: %s", _MODEL_LOAD_ERROR)
    else:
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image = image.resize(IMAGE_SIZE)
            image_array = np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)

            interpreter.set_tensor(INPUT_DETAILS[0]["index"], image_array)
            interpreter.invoke()
            predictions = interpreter.get_tensor(OUTPUT_DETAILS[0]["index"])[0]

            predicted_index = int(np.argmax(predictions))
            model_confidence = float(predictions[predicted_index])
            model_category = CLASS_NAMES[predicted_index]

            top_indices = np.argsort(predictions)[::-1][:3]
            top_predictions = [
                {
                    "category": CLASS_NAMES[int(i)],
                    "confidence": round(float(predictions[i]) * 100, 2),
                }
                for i in top_indices
            ]
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Image classification failed: {exc}",
            )

    # ── Gemini classification (primary — falls back to TFLite on any failure) ─
    gemini_result: GeminiVerification | None = None
    gemini_error: str | None = None
    primary_source: str = "model"  # overridden to "gemini" on success below

    # Size guard: Gemini inline data is limited to 10 MB
    if len(image_bytes) > _MAX_GEMINI_SIZE_BYTES:
        gemini_error = "image_too_large"
    else:
        try:
            raw = verify_image(image_bytes, file.content_type or "image/jpeg")
            # agrees_with_model is meaningful only when TFLite also ran
            agrees = (
                raw.category is not None
                and model_category is not None
                and raw.category == model_category
            )
            gemini_result = GeminiVerification(
                is_waste=raw.is_waste,
                category=raw.category,
                confidence=raw.confidence,
                agrees_with_model=agrees,
                reason=raw.reason,
            )
            # Gemini is primary when it confirms a valid waste category
            if raw.is_waste and raw.category is not None:
                primary_source = "gemini"
        except EnvironmentError:
            gemini_error = "not_configured"
        except RuntimeError as exc:
            msg = str(exc)
            msg_lower = msg.lower()
            if any(msg.startswith(p) for p in _GEMINI_QUOTA_PREFIXES) or \
               any(kw in msg_lower for kw in _GEMINI_QUOTA_KEYWORDS):
                gemini_error = "rate_limited"
            elif msg.startswith(_GEMINI_TIMEOUT_PREFIX):
                gemini_error = "timeout"
            else:
                gemini_error = "api_error"
            logger.warning("Gemini error: %s", exc)
        except ValueError as exc:
            gemini_error = "invalid_response"
            logger.warning("Gemini schema error: %s", exc)
        except Exception as exc:
            gemini_error = "unexpected_error"
            logger.warning("Gemini unexpected error: %s", exc)

    # ── Resolve final model_category for the response ─────────────────────────
    # CombinedScanResponse.model_category is a required str field.
    # When TFLite is unavailable, use the Gemini category if it succeeded,
    # otherwise we cannot produce a valid result — return 503.
    if model_category is None:
        if gemini_result is not None and gemini_result.category is not None:
            # Gemini succeeded; use its category as the model_category stand-in.
            model_category = gemini_result.category
            model_confidence = 0.0   # no TFLite confidence to report
        else:
            # Neither TFLite nor Gemini produced a usable result.
            raise HTTPException(
                status_code=503,
                detail=(
                    "Local TFLite classifier is not available and Gemini classification "
                    "did not return a result. Place the TFLite model file at "
                    f"{MODEL_PATH.relative_to(BASE_DIR)} to enable offline classification."
                ),
            )

    return CombinedScanResponse(
        status="success",
        filename=file.filename,
        model_category=model_category,
        model_confidence=round(model_confidence * 100, 2),
        top_predictions=top_predictions,
        model="ecodistrict_garbage_10class_v1",
        primary_source=primary_source,
        gemini=gemini_result,
        gemini_error=gemini_error,
    )
