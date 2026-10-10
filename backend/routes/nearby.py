"""
routes/nearby.py — Server-side proxy for Overpass API (OpenStreetMap nearby search).

GET /api/nearby?lat=<float>&lng=<float>&radius=<int>

WHY A PROXY:
  Public Overpass instances do not send CORS headers for arbitrary browser
  origins, so direct browser-to-Overpass requests fail with a CORS error.
  This route makes the upstream call server-side and returns raw Overpass JSON
  to the frontend, which handles all classification and normalisation itself.

SECURITY:
  - Coordinates are range-validated (lat −90..90, lng −180..180).
  - Radius is capped at MAX_RADIUS_M to prevent oversized bbox queries.
  - The Overpass QL query is constructed here — the caller cannot inject QL.
  - No user-supplied query strings are accepted or forwarded.
  - Overpass response is returned verbatim; no sensitive data is logged.

UPSTREAM STRATEGY:
  Endpoints are tried in order; each attempt uses a 20 s timeout.
  1. overpass.openstreetmap.fr  (primary — most reliable in testing)
  2. overpass-api.de            (secondary — high-traffic, occasionally 504)
  3. overpass.kumi.systems      (tertiary — returns HTTP 500 from some IPs)
  On transient failure (timeout, HTTP 500/502/503/504) the next endpoint is
  tried.  HTTP 429 from any instance → return 429 immediately, no retry.
  Any non-transient non-OK status → return 502 immediately.
  All endpoints exhausted → return 503 with a clear message.

CACHING:
  Responses are cached in memory for CACHE_TTL_S seconds keyed by
  (lat_rounded, lng_rounded, radius).  Coordinates are rounded to 3 decimal
  places (~110 m grid) so nearby searches share cache entries.  The cache is
  bounded to CACHE_MAX_ENTRIES to prevent unbounded memory growth.
  This is an in-process dict cache — sufficient for a single-worker dev server.
"""

import hashlib
import time
import urllib.parse
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/nearby", tags=["nearby"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_RADIUS_M   = 10_000   # hard cap on search radius
DEFAULT_RADIUS = 5_000
UPSTREAM_TIMEOUT = 20.0   # seconds per upstream attempt
CACHE_TTL_S    = 120      # cache results for 2 minutes
CACHE_MAX_ENTRIES = 256   # evict oldest entries beyond this

_OVERPASS_ENDPOINTS = [
    # Endpoints are tried in order on transient failure.
    # overpass.openstreetmap.fr is the most reliable from this host in testing;
    # overpass-api.de is the canonical server but is often busy (HTTP 504);
    # overpass.kumi.systems returns HTTP 500 from some network locations.
    "https://overpass.openstreetmap.fr/api/interpreter",  # primary
    "https://overpass-api.de/api/interpreter",            # secondary
    "https://overpass.kumi.systems/api/interpreter",      # tertiary
]

# Transient HTTP status codes that warrant fallback to the next endpoint.
# 500 is included because overpass.kumi.systems returns it as a server-side
# misconfiguration for some client IPs — the same query succeeds on other
# mirrors, so it is safe to retry rather than propagate as a final error.
_TRANSIENT_STATUSES = {500, 502, 503, 504}

# ── Simple in-process cache ────────────────────────────────────────────────────

_cache: dict[str, tuple[float, Any]] = {}   # key → (expires_at, payload)


def _cache_key(lat: float, lng: float, radius: int) -> str:
    # Round to 3 dp (~110 m) so neighbouring requests share entries
    sig = f"{lat:.3f},{lng:.3f},{radius}"
    return hashlib.md5(sig.encode()).hexdigest()  # noqa: S324 (not security-critical)


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.monotonic() < entry[0]:
        return entry[1]
    _cache.pop(key, None)
    return None


def _cache_set(key, value: Any) -> None:
    if len(_cache) >= CACHE_MAX_ENTRIES:
        # Evict the single oldest entry to keep memory bounded
        oldest = min(_cache, key=lambda k: _cache[k][0])
        _cache.pop(oldest, None)
    _cache[key] = (time.monotonic() + CACHE_TTL_S, value)


# ── Overpass query builder ─────────────────────────────────────────────────────

def _build_overpass_query(lat: float, lng: float, radius_m: int) -> str:
    """
    Build the Overpass QL query for waste-management facilities.
    Matches the tag set used by the frontend classifier in services/maps.js.
    Constructs the query server-side — never accepts user-supplied QL.
    """
    delta = radius_m / 111_000   # 1 degree ≈ 111 km
    s = f"{lat - delta:.6f}"
    w = f"{lng - delta:.6f}"
    n = f"{lat + delta:.6f}"
    e = f"{lng + delta:.6f}"
    bbox = f"{s},{w},{n},{e}"

    conditions = [
        "amenity=recycling",
        "amenity=waste_disposal",
        "amenity=waste_transfer_station",
        "landuse=recycling",
        "man_made=waste_transfer_station",
        "recycling:electronics=yes",
        "shop=scrap_metal",
        "industrial=scrap_yard",
    ]

    unions = "".join(
        f'node["{k}"="{v}"]({bbox});\nway["{k}"="{v}"]({bbox});\n'
        for tag in conditions
        for k, v in [tag.split("=", 1)]
    )

    return f"[out:json][timeout:15];\n(\n{unions});\nout body center qt;"


# ── Upstream HTTP helper ───────────────────────────────────────────────────────

# Overpass API usage policy requires a descriptive User-Agent so operators
# can identify clients.  Without one, overpass-api.de returns HTTP 406.
# https://dev.overpass-api.de/overpass-doc/en/preface/installation.html
_USER_AGENT = "EcoDistrict/1.0 (waste-management platform; contact: ecodistrict-dev@localhost)"


async def _fetch_overpass(endpoint: str, query: str) -> httpx.Response:
    """
    POST query to one Overpass endpoint.
    Raises httpx.TimeoutException on timeout; returns Response otherwise.
    """
    async with httpx.AsyncClient() as client:
        return await client.post(
            endpoint,
            content=urllib.parse.urlencode({"data": query}),
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": _USER_AGENT,
            },
            timeout=UPSTREAM_TIMEOUT,
        )


# ── Route ──────────────────────────────────────────────────────────────────────

@router.get("")
async def nearby_facilities(
    lat: float = Query(..., ge=-90.0,  le=90.0,  description="Latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
    radius: int = Query(DEFAULT_RADIUS, ge=100,  le=MAX_RADIUS_M,
                        description="Search radius in metres (max 10 000)"),
) -> JSONResponse:
    """
    Proxy Overpass QL query for nearby waste-management facilities.

    Returns the raw Overpass JSON response so the frontend classifier
    (services/maps.js) can parse and normalise results as usual.

    Errors are returned as JSON with a human-readable `detail` field,
    using the same structure as FastAPI's default HTTPException responses.
    """
    key = _cache_key(lat, lng, radius)
    cached = _cache_get(key)
    if cached is not None:
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    query = _build_overpass_query(lat, lng, radius)

    last_error: str = "Unknown error"

    for i, endpoint in enumerate(_OVERPASS_ENDPOINTS):
        try:
            resp = await _fetch_overpass(endpoint, query)
        except httpx.TimeoutException:
            last_error = "Overpass request timed out."
            if i < len(_OVERPASS_ENDPOINTS) - 1:
                continue   # try next endpoint
            raise HTTPException(
                status_code=504,
                detail="OpenStreetMap search timed out on all servers. Please try again later.",
            )
        except httpx.RequestError as exc:
            last_error = f"Network error: {exc}"
            raise HTTPException(
                status_code=503,
                detail=f"Could not reach OpenStreetMap server: {exc}",
            )

        if resp.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="OpenStreetMap is temporarily rate-limited. Please wait and try again.",
            )

        if resp.status_code in _TRANSIENT_STATUSES:
            last_error = f"Upstream returned HTTP {resp.status_code}."
            if i < len(_OVERPASS_ENDPOINTS) - 1:
                continue   # try next endpoint
            raise HTTPException(
                status_code=503,
                detail=(
                    "OpenStreetMap servers are temporarily unavailable "
                    f"(HTTP {resp.status_code}). Please try again later."
                ),
            )

        if not resp.is_success:
            raise HTTPException(
                status_code=502,
                detail=f"Overpass returned an unexpected error (HTTP {resp.status_code}).",
            )

        # Success — parse, cache, return
        try:
            payload = resp.json()
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Overpass returned a non-JSON response.",
            )

        _cache_set(key, payload)
        return JSONResponse(content=payload, headers={"X-Cache": "MISS"})

    # Both endpoints failed with transient errors
    raise HTTPException(
        status_code=503,
        detail=f"OpenStreetMap search failed on all servers. Last error: {last_error}",
    )
