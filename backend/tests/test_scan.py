"""
tests/test_scan.py — Unit tests for POST /api/ai/scan.

Tests cover:
  - Content-type validation (400 on non-image)
  - Response shape: model_category, model_confidence, top_predictions, primary_source
  - Gemini absent (key not set) → primary_source="model", gemini=null
  - Gemini succeeds with waste category → primary_source="gemini", gemini.category used
  - Gemini succeeds, is_waste=False → primary_source="model" (not-waste falls back)
  - Gemini fails (RuntimeError, ValueError, unexpected) → primary_source="model", HTTP 200
  - Quota exhausted (429) → gemini_error="rate_limited", primary_source="model", HTTP 200
  - Timeout → gemini_error="timeout", primary_source="model", HTTP 200
  - Rate-limit RuntimeError → primary_source="model", gemini_error="rate_limited"
  - Image too large → primary_source="model", gemini_error="image_too_large"
  - TFLite error → HTTP 500
  - primary_source is always present and one of {"gemini", "model"}

Run with:
  cd backend && source venv/bin/activate
  pytest tests/test_scan.py -v
"""

import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app  # noqa: E402

client = TestClient(app)

VALID_CATEGORIES = {
    "battery", "biological", "cardboard", "clothes",
    "glass", "metal", "paper", "plastic", "shoes", "trash",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_png_bytes(width=64, height=64) -> bytes:
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_gemini_response(
    is_waste=True,
    category="plastic",
    confidence="high",
    usable_for_dataset=True,
    reason="Clear image of a plastic bottle.",
):
    from schemas.image_verify import ImageVerifyResponse
    return ImageVerifyResponse(
        is_waste=is_waste,
        category=category,
        confidence=confidence,
        usable_for_dataset=usable_for_dataset,
        reason=reason,
    )


def _post_scan(image_bytes: bytes, content_type: str = "image/png"):
    return client.post(
        "/api/ai/scan",
        files={"file": ("test.png", image_bytes, content_type)},
    )


def _get_model_cat(png: bytes) -> str:
    """Return the actual TFLite prediction for a PNG without calling Gemini."""
    with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
        r = _post_scan(png)
    assert r.status_code == 200
    return r.json()["model_category"]


# ── Content-type validation ────────────────────────────────────────────────────

class TestInputValidation:
    def test_rejects_non_image_content_type(self):
        r = client.post(
            "/api/ai/scan",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 400
        assert "valid image" in r.json()["detail"].lower()

    def test_accepts_valid_png(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        assert r.status_code == 200

    def test_accepts_jpeg_content_type(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = client.post(
                "/api/ai/scan",
                files={"file": ("test.jpg", _make_png_bytes(), "image/jpeg")},
            )
        assert r.status_code == 200


# ── Response shape ─────────────────────────────────────────────────────────────

class TestResponseShape:
    def test_required_fields_present(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "success"
        assert "model_category" in body
        assert "model_confidence" in body
        assert "top_predictions" in body
        assert "model" in body
        assert "primary_source" in body
        assert body["model"] == "ecodistrict_garbage_10class_v1"

    def test_primary_source_is_always_present(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        assert r.json()["primary_source"] in {"gemini", "model"}

    def test_model_confidence_is_0_to_100(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        assert 0.0 <= r.json()["model_confidence"] <= 100.0

    def test_top_predictions_has_three_entries(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        preds = r.json()["top_predictions"]
        assert len(preds) == 3
        for p in preds:
            assert "category" in p
            assert "confidence" in p

    def test_model_category_is_valid_class(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        assert r.json()["model_category"] in VALID_CATEGORIES


# ── Gemini absent / key not configured ────────────────────────────────────────

class TestGeminiAbsent:
    def test_no_key_primary_source_is_model(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None
        assert body["gemini_error"] == "not_configured"

    def test_gemini_field_is_null_not_missing(self):
        with patch("routes.ai.verify_image", side_effect=EnvironmentError("no key")):
            r = _post_scan(_make_png_bytes())
        body = r.json()
        assert "gemini" in body
        assert body["gemini"] is None


# ── Gemini is primary when it returns a valid waste category ──────────────────

class TestGeminiPrimary:
    def test_gemini_success_sets_primary_source_to_gemini(self):
        """When Gemini returns is_waste=True + valid category → primary_source='gemini'."""
        png = _make_png_bytes()
        gemini_mock = _make_gemini_response(category="plastic", reason="Plastic bottle.")
        with patch("routes.ai.verify_image", return_value=gemini_mock):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "gemini"
        assert body["gemini"] is not None
        assert body["gemini"]["category"] == "plastic"
        assert body["gemini"]["is_waste"] is True

    def test_gemini_category_overrides_local_model(self):
        """
        When Gemini returns a different category than the local model,
        primary_source is still 'gemini' and gemini.category is the one to display.
        """
        png = _make_png_bytes()
        model_cat = _get_model_cat(png)

        # Use a category guaranteed to differ from the model's output
        other_cat = next(c for c in VALID_CATEGORIES if c != model_cat)
        gemini_mock = _make_gemini_response(category=other_cat, reason="Overrides model.")
        with patch("routes.ai.verify_image", return_value=gemini_mock):
            r = _post_scan(png)

        body = r.json()
        assert body["primary_source"] == "gemini"
        assert body["gemini"]["category"] == other_cat
        # agrees_with_model reflects the disagreement
        assert body["gemini"]["agrees_with_model"] is False

    def test_gemini_success_gemini_field_has_required_fields(self):
        png = _make_png_bytes()
        gemini_mock = _make_gemini_response(category="metal")
        with patch("routes.ai.verify_image", return_value=gemini_mock):
            r = _post_scan(png)
        g = r.json()["gemini"]
        for field in ("is_waste", "category", "confidence", "agrees_with_model", "reason"):
            assert field in g, f"Missing field: {field}"


# ── Gemini returns is_waste=False → fallback to model ─────────────────────────

class TestGeminiNotWaste:
    def test_not_waste_response_uses_model_as_primary(self):
        """Gemini says not-waste → primary_source stays 'model'."""
        png = _make_png_bytes()
        gemini_mock = _make_gemini_response(is_waste=False, category=None, reason="Not a waste item.")
        with patch("routes.ai.verify_image", return_value=gemini_mock):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        # Gemini result is still present for debugging
        assert body["gemini"] is not None
        assert body["gemini"]["is_waste"] is False

    def test_not_waste_gemini_error_is_null(self):
        """When Gemini explicitly says not-waste, it is not an error."""
        png = _make_png_bytes()
        gemini_mock = _make_gemini_response(is_waste=False, category=None, reason="No waste.")
        with patch("routes.ai.verify_image", return_value=gemini_mock):
            r = _post_scan(png)
        # gemini_error should be null — the call succeeded; it just said not-waste
        assert r.json()["gemini_error"] is None


# ── Gemini failure → fallback to model ────────────────────────────────────────

class TestGeminiFailure:
    def test_runtime_error_primary_source_is_model(self):
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("Gemini API request failed: connection error")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None
        assert body["gemini_error"] == "api_error"

    def test_rate_limit_sets_rate_limited_error_code(self):
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("429 resource_exhausted quota exceeded")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini_error"] == "rate_limited"

    def test_value_error_primary_source_is_model(self):
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=ValueError("response failed schema validation")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini_error"] == "invalid_response"

    def test_unexpected_exception_primary_source_is_model(self):
        png = _make_png_bytes()
        with patch("routes.ai.verify_image", side_effect=Exception("unexpected")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None

    def test_all_failures_still_return_http_200(self):
        """Any Gemini failure must never cause an HTTP error — TFLite result always returned."""
        png = _make_png_bytes()
        for exc in [
            EnvironmentError("no key"),
            RuntimeError("api error"),
            ValueError("bad schema"),
            Exception("unexpected"),
        ]:
            with patch("routes.ai.verify_image", side_effect=exc):
                r = _post_scan(png)
            assert r.status_code == 200, f"Expected 200 for {type(exc).__name__}"


# ── Quota exhausted (429 from Gemini) ─────────────────────────────────────────

class TestGeminiQuotaExhausted:
    def test_quota_exhausted_prefix_maps_to_rate_limited(self):
        """RuntimeError starting with 'quota_exhausted:' → gemini_error='rate_limited'."""
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("quota_exhausted: 429 RESOURCE_EXHAUSTED")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None
        assert body["gemini_error"] == "rate_limited"

    def test_quota_exhausted_still_returns_valid_local_result(self):
        """Even when quota is hit, model_category must be a valid class."""
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("quota_exhausted: 429 RESOURCE_EXHAUSTED")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["model_category"] in VALID_CATEGORIES
        assert body["model_confidence"] >= 0


# ── Timeout ───────────────────────────────────────────────────────────────────

class TestGeminiTimeout:
    def test_timeout_prefix_maps_to_timeout_error_code(self):
        """RuntimeError starting with 'timeout:' → gemini_error='timeout'."""
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("timeout: Gemini request timed out after 20s")):
            r = _post_scan(png)
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None
        assert body["gemini_error"] == "timeout"

    def test_timeout_still_returns_http_200(self):
        png = _make_png_bytes()
        with patch("routes.ai.verify_image",
                   side_effect=RuntimeError("timeout: request timed out")):
            r = _post_scan(png)
        assert r.status_code == 200


# ── Size guard ────────────────────────────────────────────────────────────────

class TestSizeGuard:
    def test_oversized_image_skips_gemini_uses_model(self):
        png = _make_png_bytes()
        with patch("routes.ai._MAX_GEMINI_SIZE_BYTES", 10):
            with patch("routes.ai.verify_image") as mock_verify:
                r = _post_scan(png)
        mock_verify.assert_not_called()
        body = r.json()
        assert r.status_code == 200
        assert body["primary_source"] == "model"
        assert body["gemini"] is None
        assert body["gemini_error"] == "image_too_large"


# ── TFLite error ──────────────────────────────────────────────────────────────

class TestTFLiteError:
    def test_corrupt_image_bytes_return_500(self):
        r = client.post(
            "/api/ai/scan",
            files={"file": ("test.jpg", b"\xff\xd8broken", "image/jpeg")},
        )
        assert r.status_code == 500
        assert "classification failed" in r.json()["detail"].lower()
