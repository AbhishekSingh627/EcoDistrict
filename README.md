# EcoDistrict — Intelligent District Waste Management Platform

> Supporting **UN SDG 12** — Responsible Consumption and Production

EcoDistrict helps communities improve waste segregation, increase recycling rates, and discover nearby waste-management infrastructure. It combines a trained local waste image classifier, a real-time facility map, and a district-scale analytics dashboard — all running without any cloud AI dependency for core classification.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
  - [1 — Backend](#1--backend)
  - [2 — Frontend](#2--frontend)
  - [3 — Environment Variables](#3--environment-variables)
- [API Reference](#api-reference)
- [ML Model](#ml-model)
- [Running Tests](#running-tests)
- [Known Limitations](#known-limitations)
- [Security Notes](#security-notes)

---

## Features

### ✅ Implemented and live

| Feature | Description |
|---------|-------------|
| **Waste Image Classifier** | Upload a photo of waste → `POST /api/ai/scan` runs Google Gemini as the primary classifier with the locally-running TFLite model as an automatic fallback. Returns a 10-class category, confidence score, top-3 predictions, and a `primary_source` field indicating which classifier was used. |
| **Waste Map — Registered tab** | Leaflet/OpenStreetMap map centred on Ahmedabad. Displays real disposal/recycling locations stored in the SQLite database (`GET /api/locations/`). |
| **Waste Map — Find Nearby tab** | Uses browser geolocation to search for real nearby waste-management facilities. Primary provider: Google Places JS API (if key is configured). Automatic fallback: OpenStreetMap/Overpass data via the backend proxy. The map works fully without any API key. |
| **Waste Map — Sample Locations tab** | Fixed set of illustrative sample locations (clearly labelled as preview data, not real Ahmedabad facilities) for UI demonstration. |
| **District Dashboard** | Administrative overview with waste-total, category-breakdown, and collection-trend charts. Currently uses clearly-labelled sample data; will pull from live analytics endpoints in Phase 2. |
| **My Impact** | Personal sustainability dashboard with bar and pie charts. Currently uses clearly-labelled sample data; will pull from `GET /api/waste/records` in Phase 2. |
| **Gemini Dataset Curator** | `POST /api/ai/verify-image` — sends an image to Google Gemini and returns a structured JSON verdict on whether it is a suitable training candidate for the waste classifier. This is a **human-review assistant only** and does not affect the TFLite classifier. Requires `GEMINI_API_KEY`. |
| **Waste records API** | `GET/POST /api/waste/records` and `GET /api/waste/categories` — store and retrieve waste disposal events in SQLite. |
| **Locations API** | `GET/POST /api/locations/` — manage physical disposal/recycling points. |
| **Backend proxy for OSM** | `GET /api/nearby` — proxies Overpass QL queries server-side to avoid browser CORS issues. Includes coordinate validation, in-process caching (2 min TTL), primary/secondary endpoint fallback, and a correct `User-Agent` header. |

### ⚠️ Placeholder / Phase 2

| Feature | Status |
|---------|--------|
| Analytics aggregation | `GET /api/analytics/summary` and `/monthly` return placeholder zeros. Real aggregation will be added in Phase 2 once the database has live records. |
| User authentication | Database model exists (`users` table) but no auth endpoints or JWT logic are implemented yet. `POST /api/waste/records` hardcodes `user_id=0`. |
| Location management UI | Locations can be added via the API (`POST /api/locations/`) but there is no frontend form for it yet. |

---

## Technology Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| Vite | 8 | Build tool and dev server |
| React Router | 7 | Client-side routing |
| React Leaflet + Leaflet | 5 / 1.9 | Interactive OpenStreetMap map |
| Recharts | 3 | Bar, pie, and area charts |
| Tailwind CSS | 3 | Utility-first styling |
| Lucide React | 1.49 | Icon set |

### Backend
| Library | Version | Purpose |
|---------|---------|---------|
| Python | 3.12 | Runtime |
| FastAPI | 0.142 | REST API framework |
| Uvicorn | 0.54 | ASGI server |
| SQLAlchemy | 2.1 | ORM and database abstraction |
| SQLite | (built-in) | Local database |
| Pydantic | 2.13 | Request/response validation |
| ai-edge-litert | 2.2 | TFLite inference runtime (LiteRT) |
| Pillow | 12 | Image pre-processing for the classifier |
| NumPy | 2.5 | Tensor manipulation |
| httpx | 0.28 | Async HTTP client for the Overpass proxy |
| google-genai | ≥2.28 | Gemini API client (dataset curation only) |
| python-dotenv | 1.2 | `.env` file loading |

---

## Project Structure

```
EcoDistrict/
├── .gitignore                        # Protects .env, venv, node_modules, *.tflite, *.db
├── README.md
│
├── frontend/
│   ├── .env.example                  # Copy to .env — documents VITE_GOOGLE_MAPS_API_KEY
│   ├── vite.config.js                # Dev proxy: /api → http://127.0.0.1:8000
│   ├── package.json
│   └── src/
│       ├── App.jsx                   # Routes: / /scan /map /impact /district
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── ScanWaste.jsx         # Image upload → POST /api/ai/scan
│       │   ├── WasteMap.jsx          # 3-tab map: Registered / Sample Locations / Find Nearby
│       │   ├── MyImpact.jsx          # Personal charts (sample data, Phase 1)
│       │   └── DistrictDashboard.jsx # District charts (sample data, Phase 1)
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── StatCard.jsx
│       │   └── DemoBanner.jsx
│       ├── services/
│       │   └── maps.js               # Google Places + OSM classification logic
│       ├── hooks/
│       │   └── useNearbyFacilities.js # Google → OSM fallback hook
│       └── data/
│           └── sampleLocations.js    # Sample Locations tab data (illustrative Delhi coords, labelled)
│
├── backend/
│   ├── .env.example                  # Copy to .env — documents GEMINI_API_KEY
│   ├── main.py                       # FastAPI app, CORS, route registration
│   ├── database.py                   # SQLAlchemy engine + session (SQLite default)
│   ├── models.py                     # ORM models: User, WasteCategory, WasteRecord, Location
│   ├── requirements.txt
│   ├── routes/
│   │   ├── ai.py                     # POST /api/ai/scan (Gemini+TFLite), POST /api/ai/classify (TFLite-only)
│   │   ├── verify.py                 # POST /api/ai/verify-image  (Gemini curation)
│   │   ├── nearby.py                 # GET  /api/nearby  (Overpass proxy)
│   │   ├── locations.py              # GET/POST /api/locations/
│   │   ├── waste.py                  # GET/POST /api/waste/*
│   │   └── analytics.py              # GET /api/analytics/* (placeholder)
│   ├── schemas/                      # Pydantic request/response schemas
│   ├── services/
│   │   ├── gemini_verify.py          # Gemini API wrapper (dataset curation)
│   │   └── seed.py                   # Seeds 8 waste categories on first startup
│   ├── ml/
│   │   └── models/
│   │       ├── class_names.json      # 10 classifier class labels (committed)
│   │       └── *.tflite              # Model weights — gitignored, not committed
│   └── tests/
│       ├── test_nearby.py            # 38 unit tests for the Overpass proxy
│       └── test_scan.py              # 26 unit tests for POST /api/ai/scan
│
├── ml/                               # ML pipeline scripts (training, evaluation)
├── data/
│   ├── sample_data/sample_records.json
│   └── waste_locations/sample_locations.json
└── docs/                             # (empty — reserved for future documentation)
```

---

## Prerequisites

- **Python 3.10 or later** (developed and tested on 3.12)
- **Node.js 18 or later** (for the frontend)
- **pip** and **venv** (standard with Python)

The TFLite model file (`*.tflite`) is **not committed to the repository** because of its size (~8.5 MB).
A hosted download link will be published with the project release. Until then, contact the project maintainer to obtain the file and place it at:

```
backend/ml/models/ecodistrict_garbage_10class_v1.tflite
```

The backend will fail to start if this file is missing — `routes/ai.py` loads and allocates the interpreter at startup.

---

## Local Setup

### 1 — Backend

```bash
cd backend

# Create a virtual environment (skip if already done)
python3 -m venv venv

# Activate it
source venv/bin/activate          # Linux / macOS
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy the environment template and fill in your keys (see §3 below)
cp .env.example .env

# Start the API server
uvicorn main:app --reload --port 8000
```

The backend will:
1. Create `ecodistrict.db` (SQLite) on first run if it does not exist
2. Seed 8 waste categories automatically
3. Load the TFLite model into memory — this takes a second on first start

**Verify it is running:**
- Health check: <http://127.0.0.1:8000/api/health>
- Interactive API docs: <http://127.0.0.1:8000/api/docs>

### 2 — Frontend

Open a **second terminal** (keep the backend running in the first):

```bash
cd frontend

# Install dependencies (skip if node_modules already exists)
npm install

# Copy the environment template (see §3 below)
cp .env.example .env

# Start the Vite development server
npm run dev
```

The frontend will be available at <http://localhost:5173>

Vite proxies all `/api/*` requests to `http://127.0.0.1:8000` automatically — no CORS configuration is needed during development.

### 3 — Environment Variables

#### `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in:

```
# Required for POST /api/ai/verify-image (Gemini dataset curation)
# Get a key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-key-here
```

`GEMINI_API_KEY` is **only** used for the dataset-curation endpoint. The TFLite classifier (`POST /api/ai/classify`) runs entirely locally and does not require any API key.

#### `frontend/.env`

Copy `frontend/.env.example` to `frontend/.env`. The only variable is:

```
# Optional — the map works without this key (falls back to OpenStreetMap)
VITE_GOOGLE_MAPS_API_KEY=your-key-here
```

If this key is absent or empty, the **Find Nearby** feature falls back automatically to free OpenStreetMap/Overpass data via the backend proxy. No key is required to use the map.

If you do add a key, **you must restrict it** in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/):
- Application restrictions → HTTP referrers → add your domain and `http://localhost:5173/*`
- API restrictions → select **Maps JavaScript API** and **Places API** (legacy, not "Places API New")

See `frontend/.env.example` for full setup and billing notes.

---

## API Reference

Full interactive documentation (Swagger UI) is available at:

```
http://127.0.0.1:8000/api/docs
```

### Endpoint summary

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/health` | Liveness probe | ✅ Live |
| GET | `/api/waste/categories` | List the 8 seeded waste categories | ✅ Live |
| GET | `/api/waste/records` | List waste disposal records | ✅ Live |
| POST | `/api/waste/records` | Log a new waste disposal event | ✅ Live |
| GET | `/api/waste/records/{id}` | Retrieve one record | ✅ Live |
| GET | `/api/locations/` | List registered disposal/recycling locations | ✅ Live |
| POST | `/api/locations/` | Add a location (no auth yet — Phase 2) | ✅ Live |
| GET | `/api/locations/{id}` | Retrieve one location | ✅ Live |
| GET | `/api/analytics/summary` | District summary statistics | ⚠️ Placeholder |
| GET | `/api/analytics/monthly` | Monthly waste trend | ⚠️ Placeholder |
| POST | `/api/ai/scan` | **Primary scanner** — Gemini + TFLite combined; used by `ScanWaste.jsx` | ✅ Live |
| POST | `/api/ai/classify` | TFLite-only classifier (internal / legacy; not used by the frontend) | ✅ Live |
| GET | `/api/ai/categories` | List classifier categories and model name | ✅ Live |
| POST | `/api/ai/verify-image` | Dataset-curation verdict via Gemini | ✅ Live (needs `GEMINI_API_KEY`) |
| GET | `/api/nearby` | Proxy Overpass QL query for nearby facilities | ✅ Live |

### `POST /api/ai/scan` — example response

`POST /api/ai/scan` is the endpoint called by the frontend scanner. It runs the TFLite model and, when `GEMINI_API_KEY` is set, also calls Gemini as a primary classifier. The `primary_source` field tells the frontend which result to display.

```json
{
  "status": "success",
  "filename": "bottle.jpg",
  "model_category": "plastic",
  "model_confidence": 94.31,
  "top_predictions": [
    { "category": "plastic",   "confidence": 94.31 },
    { "category": "glass",     "confidence":  3.12 },
    { "category": "cardboard", "confidence":  1.44 }
  ],
  "model": "ecodistrict_garbage_10class_v1",
  "primary_source": "gemini",
  "gemini": {
    "is_waste": true,
    "category": "plastic",
    "confidence": "high",
    "agrees_with_model": true,
    "reason": "Clear image of a plastic bottle."
  },
  "gemini_error": null
}
```

When Gemini is absent or fails, `primary_source` is `"model"`, `gemini` is `null`, and `gemini_error` explains why (e.g. `"not_configured"`, `"rate_limited"`, `"timeout"`).

### `POST /api/ai/classify` — TFLite-only response

`POST /api/ai/classify` runs only the local TFLite model (no Gemini call). It is retained as an internal endpoint.

```json
{
  "status": "success",
  "filename": "bottle.jpg",
  "category": "plastic",
  "confidence": 94.31,
  "top_predictions": [
    { "category": "plastic",   "confidence": 94.31 },
    { "category": "glass",     "confidence":  3.12 },
    { "category": "cardboard", "confidence":  1.44 }
  ],
  "model": "ecodistrict_garbage_10class_v1"
}
```

### `GET /api/nearby` — query parameters

| Parameter | Type | Required | Range | Default | Description |
|-----------|------|----------|-------|---------|-------------|
| `lat` | float | ✅ | −90 to 90 | — | Latitude |
| `lng` | float | ✅ | −180 to 180 | — | Longitude |
| `radius` | int | ❌ | 100 to 10 000 | 5000 | Search radius in metres |

---

## ML Model

### Classifier: `ecodistrict_garbage_10class_v1`

| Property | Value |
|----------|-------|
| Format | TensorFlow Lite (`.tflite`) |
| Runtime | LiteRT (`ai-edge-litert`) |
| Input | 224 × 224 RGB image, pixel values 0–255 (no normalisation) |
| Output | 10-class softmax probabilities |
| File size | ~8.5 MB |
| Classes | `battery`, `biological`, `cardboard`, `clothes`, `glass`, `metal`, `paper`, `plastic`, `shoes`, `trash` |

The model file is **not stored in this repository** (it is listed in `.gitignore`). Place the file at `backend/ml/models/ecodistrict_garbage_10class_v1.tflite` before starting the backend.

`backend/ml/models/class_names.json` (committed) maps model output indices to human-readable class labels and is the source of truth for the 10 class names.

### Dataset curation: Gemini verify endpoint

`POST /api/ai/verify-image` uses Google Gemini as a dataset-curation assistant. It asks Gemini whether an uploaded image is a suitable training/validation candidate for the 10-class classifier. Results are returned as structured JSON and **must be human-reviewed** before any image is added to the dataset. This endpoint does not affect or replace the TFLite classifier.

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

Expected result: **64 passed** — 38 tests in `test_nearby.py` (Overpass proxy: validation, query construction, caching, fallback, timeout, User-Agent) and 26 tests in `test_scan.py` (combined scan endpoint: Gemini primary/fallback, error codes, size guard, TFLite-only path).

Frontend lint:

```bash
cd frontend
npm run lint
```

Expected result: **0 warnings, 0 errors** (oxlint, 16 files, 104 rules).

Frontend production build:

```bash
cd frontend
npm run build
```

Expected: clean build. Vite emits a bundle-size advisory because Recharts and Leaflet are bundled together in a single chunk — this is a performance note, not an error. Code-splitting can reduce the bundle size in a future optimisation pass.

---

## Known Limitations

| Area | Detail |
|------|--------|
| Authentication | No auth is implemented. All API endpoints are public. `POST /api/waste/records` uses a hardcoded `user_id=0`. |
| Analytics | `/api/analytics/summary` and `/monthly` return placeholder zeros, not real aggregations. |
| Classifier UI coverage | `ScanWaste.jsx` provides specific disposal guidance (`label`, `disposal_type`, `explanation`) for all 10 model output classes. An additional generic fallback is used only for any unexpected category string outside the known 10. |
| OSM data quality | Waste/recycling facilities in many Indian cities have sparse or unnamed entries in OpenStreetMap. The Find Nearby feature may return zero results in areas with low OSM coverage even when facilities exist. |
| Single-worker cache | The `GET /api/nearby` in-process cache works correctly in development (single Uvicorn worker). In a multi-worker production deployment, each worker has its own cache; use Redis or a shared cache layer if consistency matters. |
| SQLite in production | SQLite is suitable for development and low-traffic single-server deployments. Switch `DATABASE_URL` in `.env` to a PostgreSQL or MySQL URL for production. |
| Pydantic v2 deprecation warnings | `backend/schemas/` uses the Pydantic v1 class-based `Config` style. This produces deprecation warnings at startup; the code works correctly and will be migrated to `model_config = ConfigDict(...)` in a future update. |

---

## Security Notes

### Environment files — never commit secrets

- **`backend/.env`** contains `GEMINI_API_KEY`. It is excluded from Git by three independent rules (root `.gitignore`, `backend/.gitignore`, and a named-path rule). Never remove these rules or force-add the file.
- **`frontend/.env`** would contain `VITE_GOOGLE_MAPS_API_KEY` if you add one. It is excluded from Git by the root `.gitignore` and `frontend/.gitignore`. Never commit it.
- Both repositories include `.env.example` files with placeholder values. These are safe to commit — they contain no real keys.

### Google Maps key visibility

Vite bakes all `VITE_*` environment variables into the compiled JavaScript bundle at build time. **The Google Maps key is visible to anyone who views the page source.** This is expected and normal for browser-side Maps/Places usage — but you **must** restrict the key:

1. In [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/), apply **HTTP referrer** restrictions (your domain + `localhost:5173`)
2. Apply **API restrictions**: enable only *Maps JavaScript API* and *Places API* (legacy)

An unrestricted key can be used by anyone who finds it in the bundle, leading to unexpected billing charges.

### Model files

`.tflite` model files are listed in `.gitignore` because they are large binary artefacts unsuitable for Git history. They contain no secrets but should be distributed via a release download or object storage rather than the repository.

---

*EcoDistrict — Supporting UN SDG 12: Responsible Consumption and Production*
