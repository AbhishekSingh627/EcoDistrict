"""
services/gemini_verify.py — Waste classification using Google Gemini.

Gemini is the PRIMARY classifier in /api/ai/scan.  The TFLite model runs in
parallel and is used as fallback when Gemini fails or is unavailable.

Error contract (re-raised to routes/ai.py):
  EnvironmentError   — GEMINI_API_KEY not set.
  RuntimeError       — API call failed; message begins with one of:
                         "quota_exhausted:"  — daily/minute quota hit (permanent today)
                         "rate_limited:"     — short-term rate limit (retry later)
                         "api_error:"        — other API-level error
                         "timeout:"          — request timed out
  ValueError         — Gemini returned a response that fails schema validation.

REQUIRED ENVIRONMENT VARIABLE:
  GEMINI_API_KEY — Google AI Studio API key (never hardcode, never log).
"""

import json
import os

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from google.genai.types import HttpOptions, HttpRetryOptions

from schemas.image_verify import ImageVerifyResponse


# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a waste-classification assistant for the EcoDistrict waste-management project.
Identify the waste category shown in the image.

The 10 valid categories are (use EXACTLY these strings, lower-case):
  battery, biological, cardboard, clothes, glass, metal, paper, plastic, shoes, trash

Respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON.

JSON schema:
{
  "is_waste": <true|false>,
  "category": <one of the 10 strings above, or null>,
  "confidence": <"high"|"medium"|"low">,
  "usable_for_dataset": <true|false>,
  "reason": "<short explanation, 1-2 sentences>"
}

Rules:
- Set is_waste=false and category=null when the image does not clearly show a waste item.
- Use confidence="low" when the image is ambiguous or the category is uncertain.
- Set usable_for_dataset=false when the category is uncertain, the image is blurry/dark/cropped,
  or there are multiple conflicting waste types.
- Do NOT invent categories outside the 10 listed above.
- Do NOT add any text outside the JSON object.
"""

# ── Request configuration ─────────────────────────────────────────────────────

# HttpOptions.timeout is in MILLISECONDS (SDK converts to seconds internally).
# 30 000 ms = 30 s — enough for a multimodal Gemini request under normal load.
_REQUEST_TIMEOUT_MS = 30_000

# Retry only 5xx transient server errors — never 4xx quota/auth errors.
_RETRY_OPTIONS = HttpRetryOptions(
    attempts=2,              # 1 original + 1 retry on transient 5xx
    initial_delay=1.5,
    max_delay=6.0,
    http_status_codes=[500, 502, 503, 504],   # 4xx are permanent — excluded
)


# ── Public function ───────────────────────────────────────────────────────────

def verify_image(image_bytes: bytes, mime_type: str) -> ImageVerifyResponse:
    """
    Send *image_bytes* to Gemini and return a validated ImageVerifyResponse.

    Raises:
        EnvironmentError   — GEMINI_API_KEY is not set.
        ValueError         — Gemini returned a response that fails schema validation.
        RuntimeError       — Gemini API call failed (see module docstring for prefixes).
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY environment variable is not set. "
            "Add it to your backend .env file."
        )

    client = genai.Client(
        api_key=api_key,
        http_options=HttpOptions(
            timeout=_REQUEST_TIMEOUT_MS,      # milliseconds — see SDK get_timeout_in_seconds()
            retry_options=_RETRY_OPTIONS,
        ),
    )

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[_SYSTEM_PROMPT, image_part],
        )

    except genai_errors.ClientError as exc:
        # 4xx errors are permanent for the current request — do not retry.
        code = getattr(exc, "code", 0)
        status = (getattr(exc, "status", "") or "").upper()
        if code == 429 or "RESOURCE_EXHAUSTED" in status or "QUOTA" in status:
            raise RuntimeError(f"quota_exhausted: {exc}") from exc
        if code == 401 or "UNAUTHORIZED" in status or "PERMISSION" in status:
            raise RuntimeError(f"api_error: authentication failed ({code})") from exc
        raise RuntimeError(f"api_error: {exc}") from exc

    except genai_errors.ServerError as exc:
        # 5xx transient errors — already retried by the SDK up to _RETRY_OPTIONS.attempts.
        raise RuntimeError(f"api_error: {exc}") from exc

    except TimeoutError as exc:
        raise RuntimeError(f"timeout: Gemini request timed out after {_REQUEST_TIMEOUT_MS // 1000}s") from exc

    except Exception as exc:
        # Catch-all: includes network errors, SDK bugs, etc.
        msg = str(exc).lower()
        if "timeout" in msg or "timed out" in msg or "connecttimeout" in msg:
            raise RuntimeError(f"timeout: {exc}") from exc
        raise RuntimeError(f"api_error: {exc}") from exc

    raw_text = (response.text or "").strip()

    # Strip accidental markdown fences (```json ... ```)
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        raw_text = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Gemini returned non-JSON output. Raw response: {raw_text!r}"
        ) from exc

    try:
        return ImageVerifyResponse.model_validate(data)
    except Exception as exc:
        raise ValueError(
            f"Gemini response failed schema validation: {exc}. Data: {data}"
        ) from exc
