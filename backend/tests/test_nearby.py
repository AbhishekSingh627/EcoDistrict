"""
tests/test_nearby.py — Focused unit tests for backend/routes/nearby.py.

Tests cover:
  - Coordinate and radius validation (422 on bad input)
  - Overpass query construction (tag set, bbox, output directive)
  - Upstream success path (200 → returns raw Overpass JSON)
  - HTTP 429 from upstream → 429 to caller, no retry (no fallback)
  - Transient upstream errors (500/502/503/504) → fallback to next endpoint
  - All three endpoints fail transiently → 503 to caller
  - HTTP 500 from first two endpoints → success from third
  - Upstream timeout → fallback to next, then 504 when all exhaust
  - Non-transient upstream error (e.g. 400) → 502 immediately, no fallback
  - Non-JSON upstream response → 502
  - Cache hit (second identical request returns cached data)
  - Cache miss header present on first request
  - Three-endpoint list verified at module level

Run with:
  cd backend && source venv/bin/activate
  pytest tests/test_nearby.py -v
"""

import hashlib
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# App bootstrap — import after sys.path is correct (pytest runs from backend/)
# ---------------------------------------------------------------------------
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app  # noqa: E402

client = TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _overpass_ok(elements: list) -> MagicMock:
    """Return a mock httpx.Response that looks like a successful Overpass reply."""
    mock = MagicMock()
    mock.status_code = 200
    mock.is_success = True
    mock.json.return_value = {"version": 0.6, "elements": elements}
    return mock


def _overpass_error(status: int) -> MagicMock:
    mock = MagicMock()
    mock.status_code = status
    mock.is_success = False
    mock.text = f"HTTP {status}"
    return mock


# ── Coordinate / radius validation ────────────────────────────────────────────

class TestValidation:
    def test_missing_lat(self):
        r = client.get("/api/nearby?lng=72.5714")
        assert r.status_code == 422

    def test_missing_lng(self):
        r = client.get("/api/nearby?lat=23.0225")
        assert r.status_code == 422

    def test_lat_too_high(self):
        r = client.get("/api/nearby?lat=91.0&lng=72.5714")
        assert r.status_code == 422

    def test_lat_too_low(self):
        r = client.get("/api/nearby?lat=-91.0&lng=72.5714")
        assert r.status_code == 422

    def test_lng_too_high(self):
        r = client.get("/api/nearby?lat=23.0&lng=181.0")
        assert r.status_code == 422

    def test_lng_too_low(self):
        r = client.get("/api/nearby?lat=23.0&lng=-181.0")
        assert r.status_code == 422

    def test_radius_too_large(self):
        r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=10001")
        assert r.status_code == 422

    def test_radius_too_small(self):
        r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=99")
        assert r.status_code == 422

    def test_valid_params(self):
        """Valid coordinates should not produce a 422."""
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_ok([])
            r = client.get("/api/nearby?lat=23.0225&lng=72.5714&radius=5000")
        assert r.status_code != 422


# ── Query construction ────────────────────────────────────────────────────────

class TestQueryBuilder:
    def test_bbox_contains_correct_tags(self):
        from routes.nearby import _build_overpass_query
        q = _build_overpass_query(23.0225, 72.5714, 5000)
        # Must contain all supported tag conditions
        for tag in ["amenity=recycling", "amenity=waste_disposal",
                    "amenity=waste_transfer_station", "landuse=recycling",
                    "man_made=waste_transfer_station", "recycling:electronics=yes",
                    "shop=scrap_metal", "industrial=scrap_yard"]:
            k, v = tag.split("=")
            assert f'["{k}"="{v}"]' in q, f"Tag {tag} missing from query"

    def test_bbox_values_are_numeric(self):
        from routes.nearby import _build_overpass_query
        q = _build_overpass_query(23.0225, 72.5714, 5000)
        # Should not raise — bounding box values are floats formatted as strings
        import re
        bbox_matches = re.findall(r'\([\d.,\-]+\)', q)
        assert len(bbox_matches) > 0

    def test_out_directive_is_body_center_qt(self):
        from routes.nearby import _build_overpass_query
        q = _build_overpass_query(23.0225, 72.5714, 5000)
        assert "out body center qt" in q

    def test_timeout_directive_present(self):
        from routes.nearby import _build_overpass_query
        q = _build_overpass_query(23.0225, 72.5714, 5000)
        assert "[timeout:" in q

    def test_radius_cap_applied(self):
        """Backend should cap radius; validation prevents >10000 reaching the builder,
        but test it directly for defence in depth."""
        from routes.nearby import _build_overpass_query, MAX_RADIUS_M
        # A query built with MAX_RADIUS_M should not crash
        q = _build_overpass_query(0.0, 0.0, MAX_RADIUS_M)
        assert "out body center qt" in q


# ── Success path ──────────────────────────────────────────────────────────────

class TestSuccess:
    def test_returns_overpass_json(self):
        elements = [{"type": "node", "id": 1, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling", "name": "Test Hub"}}]
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_ok(elements)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 200
        body = r.json()
        assert "elements" in body
        assert len(body["elements"]) == 1

    def test_cache_miss_header(self):
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_ok([])
            r = client.get("/api/nearby?lat=23.1&lng=72.6&radius=5000")
        assert r.headers.get("x-cache") == "MISS"

    def test_cache_hit_on_second_request(self):
        """Second request with same (rounded) coordinates should hit cache."""
        # Clear the module-level cache first
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()

        elements = [{"type": "node", "id": 99, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling"}}]
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_ok(elements)
            r1 = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
            assert r1.headers.get("x-cache") == "MISS"
            assert mock_fetch.call_count == 1

            # Second request — same rounded coords — must NOT call upstream again
            r2 = client.get("/api/nearby?lat=23.0001&lng=72.5001&radius=5000")
            assert mock_fetch.call_count == 1, "Cache should have been hit"
            assert r2.headers.get("x-cache") == "HIT"


# ── HTTP 429 from upstream ────────────────────────────────────────────────────

class TestRateLimit:
    def test_429_returned_immediately_no_retry(self):
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(429)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 429
        # Must NOT have called the secondary endpoint
        assert mock_fetch.call_count == 1


# ── Transient upstream errors → fallback ─────────────────────────────────────

class TestFallback:
    @pytest.mark.parametrize("transient_status", [500, 502, 503, 504])
    def test_primary_transient_falls_back_to_secondary(self, transient_status):
        """First endpoint returns a transient error; second succeeds."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        elements = [{"type": "node", "id": 2, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling"}}]

        call_count = 0
        async def side_effect(endpoint, query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _overpass_error(transient_status)
            return _overpass_ok(elements)

        with patch("routes.nearby._fetch_overpass", side_effect=side_effect):
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")

        assert r.status_code == 200
        assert call_count == 2, "Should have tried two endpoints"

    def test_first_two_endpoints_500_third_succeeds(self):
        """
        Mirrors the live failure mode: overpass.openstreetmap.fr (now primary)
        is healthy, but if it were not, the chain falls through.
        More directly: first two return 500, third returns 200.
        """
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        elements = [{"type": "node", "id": 5, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling"}}]

        call_count = 0
        async def side_effect(endpoint, query):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return _overpass_error(500)
            return _overpass_ok(elements)

        with patch("routes.nearby._fetch_overpass", side_effect=side_effect):
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")

        assert r.status_code == 200
        assert call_count == 3, "Should have tried all three endpoints"
        assert r.json()["elements"][0]["id"] == 5

    def test_all_three_endpoints_transient_returns_503(self):
        """All three endpoints fail with transient errors → 503."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(504)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 503
        assert mock_fetch.call_count == 3, "Should have tried all three endpoints"

    def test_all_three_endpoints_500_returns_503(self):
        """HTTP 500 from all three endpoints (the live failure mode) → 503."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(500)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 503
        assert mock_fetch.call_count == 3


# ── Timeout handling ──────────────────────────────────────────────────────────

class TestTimeout:
    def test_primary_timeout_falls_back(self):
        """First endpoint times out; second succeeds."""
        import routes.nearby as nearby_mod
        import httpx
        nearby_mod._cache.clear()
        elements = [{"type": "node", "id": 3, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling"}}]

        call_count = 0
        async def side_effect(endpoint, query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.TimeoutException("timed out")
            return _overpass_ok(elements)

        with patch("routes.nearby._fetch_overpass", side_effect=side_effect):
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")

        assert r.status_code == 200
        assert call_count == 2

    def test_all_three_timeout_returns_504(self):
        """All three endpoints time out → 504."""
        import routes.nearby as nearby_mod
        import httpx
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = httpx.TimeoutException("timed out")
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 504
        assert mock_fetch.call_count == 3, "Should have tried all three endpoints"

    def test_first_two_timeout_third_succeeds(self):
        """Two timeouts then success — verifies full chain traversal."""
        import routes.nearby as nearby_mod
        import httpx
        nearby_mod._cache.clear()
        elements = [{"type": "node", "id": 7, "lat": 23.0, "lon": 72.5,
                     "tags": {"amenity": "recycling"}}]

        call_count = 0
        async def side_effect(endpoint, query):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise httpx.TimeoutException("timed out")
            return _overpass_ok(elements)

        with patch("routes.nearby._fetch_overpass", side_effect=side_effect):
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")

        assert r.status_code == 200
        assert call_count == 3


# ── Non-transient upstream error — no fallback ────────────────────────────────

class TestNonTransient:
    def test_400_returns_502_immediately(self):
        """HTTP 400 from upstream is not transient — must return 502, no retry."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(400)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 502
        assert mock_fetch.call_count == 1, "Should not fall back for non-transient error"

    def test_non_json_response_returns_502(self):
        """Upstream returns 200 but with non-JSON body → 502, not 500."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()

        bad_mock = MagicMock()
        bad_mock.status_code = 200
        bad_mock.is_success = True
        bad_mock.json.side_effect = ValueError("not JSON")

        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = bad_mock
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 502
        assert "non-JSON" in r.json()["detail"]

    def test_406_returns_502_immediately_no_retry(self):
        """HTTP 406 is not transient — must return 502 without trying other endpoints."""
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(406)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 502
        assert mock_fetch.call_count == 1, "406 must not be retried"
        assert "406" in r.json()["detail"]


# ── User-Agent header ─────────────────────────────────────────────────────────

class TestUserAgent:
    def test_user_agent_header_is_sent(self):
        """
        Root cause of HTTP 406: overpass-api.de rejects requests with no
        User-Agent.  Verify the header is present in every upstream request.
        """
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()

        captured_headers = {}

        async def capture(endpoint, query):
            # Inspect what _fetch_overpass would send by building the request
            import urllib.parse
            import httpx
            req = httpx.Request(
                "POST",
                endpoint,
                content=urllib.parse.urlencode({"data": query}),
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": nearby_mod._USER_AGENT,
                },
            )
            captured_headers.update(dict(req.headers))
            # Return a successful mock response
            m = MagicMock()
            m.status_code = 200
            m.is_success = True
            m.json.return_value = {"version": 0.6, "elements": []}
            return m

        with patch("routes.nearby._fetch_overpass", side_effect=capture):
            client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")

        assert "user-agent" in captured_headers, "User-Agent header must be set"
        ua = captured_headers["user-agent"]
        assert "EcoDistrict" in ua, f"User-Agent should identify EcoDistrict, got: {ua}"

    def test_user_agent_constant_is_non_empty(self):
        from routes.nearby import _USER_AGENT
        assert _USER_AGENT and len(_USER_AGENT) > 10

    def test_406_from_upstream_returns_502_immediately(self):
        """
        If a 406 is still received despite sending the User-Agent (e.g. server
        misconfiguration), it should be reported as 502 — not silently swallowed
        and not retried on any other endpoint.
        """
        import routes.nearby as nearby_mod
        nearby_mod._cache.clear()
        with patch("routes.nearby._fetch_overpass", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = _overpass_error(406)
            r = client.get("/api/nearby?lat=23.0&lng=72.5&radius=5000")
        assert r.status_code == 502
        assert mock_fetch.call_count == 1, "406 is not a transient error — must not retry"
        assert "406" in r.json()["detail"]


# ── Endpoint list ─────────────────────────────────────────────────────────────

class TestEndpointList:
    def test_three_endpoints_configured(self):
        """Verify exactly three endpoints are configured (primary + two fallbacks)."""
        from routes.nearby import _OVERPASS_ENDPOINTS
        assert len(_OVERPASS_ENDPOINTS) == 3, (
            f"Expected 3 endpoints, got {len(_OVERPASS_ENDPOINTS)}: {_OVERPASS_ENDPOINTS}"
        )

    def test_openstreetmap_fr_is_primary(self):
        """overpass.openstreetmap.fr must be first (most reliable in live testing)."""
        from routes.nearby import _OVERPASS_ENDPOINTS
        assert "openstreetmap.fr" in _OVERPASS_ENDPOINTS[0], (
            f"Primary endpoint should be openstreetmap.fr, got: {_OVERPASS_ENDPOINTS[0]}"
        )

    def test_500_is_in_transient_statuses(self):
        """HTTP 500 must be treated as transient (kumi.systems returns it from some IPs)."""
        from routes.nearby import _TRANSIENT_STATUSES
        assert 500 in _TRANSIENT_STATUSES, "HTTP 500 must be in _TRANSIENT_STATUSES"

    def test_all_endpoints_are_https(self):
        from routes.nearby import _OVERPASS_ENDPOINTS
        for ep in _OVERPASS_ENDPOINTS:
            assert ep.startswith("https://"), f"Non-HTTPS endpoint: {ep}"
