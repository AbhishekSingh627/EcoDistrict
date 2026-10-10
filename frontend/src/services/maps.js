/**
 * services/maps.js — Nearby waste-facility search with Google Places primary
 *                    and OpenStreetMap/Overpass fallback.
 *
 * ── Provider strategy ────────────────────────────────────────────────────────
 *  1. If VITE_GOOGLE_MAPS_API_KEY is set → try Google Places JS API (legacy
 *     nearbySearch via Maps JS SDK).
 *  2. If the key is absent OR the Google search throws → try Overpass API
 *     (OpenStreetMap data, public endpoint, single bounded query, 10 s timeout).
 *  3. If both fail → throw so the caller can surface a clear error.
 *
 * ── API key security note ────────────────────────────────────────────────────
 *  Vite bakes VITE_* variables into the JS bundle at build time.  The key IS
 *  visible to anyone who views the page source.  This is expected and normal
 *  for browser-side Maps/Places usage.  You MUST restrict the key in Google
 *  Cloud Console:
 *    • Application restrictions → HTTP referrers → add your domain + localhost
 *    • API restrictions         → Maps JavaScript API + Places API only
 *  Without restrictions an unrestricted key can be misused by anyone who
 *  finds it in your bundle.
 *
 * ── Google Places API notes ──────────────────────────────────────────────────
 *  This file uses the legacy Places JS SDK (nearbySearch on PlacesService).
 *  The new Places API (google.maps.places.Place / searchNearby) requires the
 *  "Places API (New)" product to be enabled separately in Cloud Console and a
 *  different SDK loading approach.  The legacy SDK requires:
 *    • Maps JavaScript API  (for the SDK loader)
 *    • Places API           (for nearbySearch)
 *  Both must be enabled in the same project as the key.
 *  Billing: Google offers a $200/month free-usage credit.  Each nearbySearch
 *  call costs ~$0.032 (2025 pricing).  This file runs 5 calls per user search;
 *  that is $0.16 per search.  Keep the key restricted to your domain to avoid
 *  unexpected charges.
 *
 * ── Overpass API notes ───────────────────────────────────────────────────────
 *  The public Overpass endpoint (overpass-api.de) has fair-use rate limits.
 *  This file sends ONE query per user-initiated search with a 10 s timeout.
 *  It never retries automatically.  If the server is busy (HTTP 429 or a
 *  timeout) the caller is told to try again later.
 *
 * NEVER hardcode keys here.  NEVER log the key value.
 */

// ── Shared facility configuration ─────────────────────────────────────────────

/**
 * Facility categories used for both Google Places searches and OSM tag mapping.
 *
 *  label  — shown in the UI
 *  color  — marker/badge colour
 *  googleType    — Google Places `type` param for nearbySearch
 *  googleKeyword — free-text keyword to widen the Google match
 *  osmTags       — Overpass tag conditions (OR-joined within each entry)
 */
export const FACILITY_SEARCHES = [
  {
    label: 'Recycling Centre',
    color: '#16a34a',
    googleType: 'recycling_center',
    googleKeyword: 'recycling center',
    osmTags: ['amenity=recycling', 'landuse=recycling'],
  },
  {
    label: 'Waste Management',
    color: '#dc2626',
    googleType: 'local_government_office',
    googleKeyword: 'waste management',
    osmTags: ['amenity=waste_transfer_station', 'man_made=waste_transfer_station'],
  },
  {
    label: 'E-Waste Recycling',
    color: '#7c3aed',
    googleType: 'store',
    googleKeyword: 'e-waste recycling',
    osmTags: ['recycling:electronics=yes', 'amenity=recycling'],
  },
  {
    label: 'Collection Point',
    color: '#2563eb',
    googleType: 'establishment',
    googleKeyword: 'garbage collection point',
    osmTags: ['amenity=waste_disposal', 'amenity=waste_basket'],
  },
  {
    label: 'Scrap / Recycling',
    color: '#d97706',
    googleType: 'establishment',
    googleKeyword: 'scrap dealer recycling',
    osmTags: ['shop=scrap_metal', 'industrial=scrap_yard'],
  },
]

/** All unique labels produced by FACILITY_SEARCHES */
export const FACILITY_LABELS = FACILITY_SEARCHES.map(s => s.label)

/** Colour map keyed by label */
export const FACILITY_COLORS = Object.fromEntries(
  FACILITY_SEARCHES.map(s => [s.label, s.color])
)

// ── API key guard ──────────────────────────────────────────────────────────────

/**
 * Returns true when VITE_GOOGLE_MAPS_API_KEY is present in the build env.
 * The key value is never returned or logged.
 */
export function isGoogleMapsConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
}

// ── Google Places: script loader ───────────────────────────────────────────────

let _loadPromise = null

/**
 * Dynamically injects the Maps JS API script (once) and resolves when
 * window.google.maps is ready.  The key is placed only in the script src URL
 * and never stored in a JS variable.
 *
 * @returns {Promise<void>}
 */
export function loadGoogleMaps() {
  if (_loadPromise) return _loadPromise

  _loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve()
      return
    }

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) {
      _loadPromise = null
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set.'))
      return
    }

    const cbName = '__ecodistrict_gmaps_ready__'
    window[cbName] = () => {
      delete window[cbName]
      resolve()
    }

    const script = document.createElement('script')
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&libraries=places&callback=${cbName}&loading=async`
    script.async = true
    script.defer = true
    script.onerror = () => {
      _loadPromise = null
      reject(new Error(
        'Failed to load Google Maps script. ' +
        'Check your API key, that Maps JavaScript API is enabled, and your network connection.'
      ))
    }
    document.head.appendChild(script)
  })

  return _loadPromise
}

// ── Google Places: nearby search ───────────────────────────────────────────────

function googleStatusError(status) {
  const S = window.google.maps.places.PlacesServiceStatus
  switch (status) {
    case S.OK:
    case S.ZERO_RESULTS:
      return null
    case S.REQUEST_DENIED:
      return 'Google Places request denied — check that Places API is enabled for your key.'
    case S.OVER_QUERY_LIMIT:
      return 'Google Places query limit reached. Try again later.'
    case S.INVALID_REQUEST:
      return 'Invalid request sent to Google Places.'
    default:
      return `Google Places returned status: ${status}`
  }
}

function runOneGoogleSearch(service, latLng, radiusMetres, entry) {
  return new Promise((resolve) => {
    service.nearbySearch(
      {
        location: latLng,
        radius: radiusMetres,
        type: entry.googleType,
        keyword: entry.googleKeyword,
      },
      (results, status) => {
        const err = googleStatusError(status)
        if (err) {
          console.warn(`[EcoDistrict] Google Places "${entry.label}": ${status}`)
          resolve([])
          return
        }
        if (!results || results.length === 0) { resolve([]); return }
        resolve(results.map(place => {
          const lat = place.geometry?.location?.lat?.()
          const lng = place.geometry?.location?.lng?.()
          return {
            id: place.place_id,
            name: place.name || 'Unnamed facility',
            label: entry.label,
            color: entry.color,
            address: place.vicinity || place.formatted_address || '',
            lat: typeof lat === 'number' ? lat : null,
            lng: typeof lng === 'number' ? lng : null,
            rating: place.rating ?? null,
            openNow: place.opening_hours?.open_now ?? null,
            mapsUrl: place.place_id
              ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
              : null,
            source: 'google',
          }
        }))
      }
    )
  })
}

/**
 * Search via Google Places JS SDK.
 * Throws if the SDK cannot be loaded (key absent, script error, etc.).
 *
 * @returns {Promise<Array>}
 */
export async function searchNearbyFacilitiesGoogle(lat, lng, radiusMetres = 5000) {
  await loadGoogleMaps()

  const dummyDiv = document.createElement('div')
  const service = new window.google.maps.places.PlacesService(dummyDiv)
  const latLng = new window.google.maps.LatLng(lat, lng)

  const batches = await Promise.all(
    FACILITY_SEARCHES.map(s => runOneGoogleSearch(service, latLng, radiusMetres, s))
  )

  const seen = new Set()
  const out = []
  for (const batch of batches) {
    for (const f of batch) {
      if (!seen.has(f.id) && f.lat !== null && f.lng !== null) {
        seen.add(f.id)
        out.push(f)
      }
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

// ── OpenStreetMap / Overpass: nearby search ────────────────────────────────────
// Query construction and upstream HTTP are handled by the backend proxy
// (GET /api/nearby).  The frontend only classifies and normalises the
// raw Overpass elements that the proxy returns.

/**
 * Map an OSM element's tags to the nearest FACILITY_SEARCHES entry.
 * Returns the matched entry or null if no match.
 *
 * E-Waste is checked first because a node can simultaneously have
 * amenity=recycling AND recycling:electronics=yes — the more specific
 * e-waste classification should win over the generic recycling one.
 */
function classifyOsmElement(tags) {
  // E-waste priority check: must run before the generic amenity=recycling match
  if (tags['recycling:electronics'] === 'yes') {
    const eWaste = FACILITY_SEARCHES.find(e => e.label === 'E-Waste Recycling')
    if (eWaste) return eWaste
  }

  for (const entry of FACILITY_SEARCHES) {
    for (const tagStr of entry.osmTags) {
      const [k, v] = tagStr.split('=')
      if (tags[k] === v) return entry
    }
  }

  return null
}

/**
 * Search for nearby facilities via the EcoDistrict backend proxy.
 *
 * The proxy (GET /api/nearby) makes the Overpass request server-side,
 * avoiding browser CORS restrictions on public Overpass instances.
 * Upstream fallback and timeout handling are managed by the backend.
 *
 * The frontend is still responsible for classifying, normalising, and
 * rendering the raw Overpass elements returned by the proxy.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusMetres=5000]
 * @returns {Promise<Array>}
 */
export async function searchNearbyFacilitiesOSM(lat, lng, radiusMetres = 5000) {
  console.debug('[EcoDistrict OSM] Requesting via backend proxy, radius:', radiusMetres, 'm, centre:', lat, lng)

  const url = `/api/nearby?lat=${lat}&lng=${lng}&radius=${radiusMetres}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)   // hard browser-side safety net

  let resp
  try {
    resp = await fetch(url, { signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('OpenStreetMap search timed out. Please try again.')
    }
    throw new Error(`OpenStreetMap request failed: ${err.message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!resp.ok) {
    // Surface the backend's detail message when available
    let detail = `OpenStreetMap search failed (HTTP ${resp.status}).`
    try {
      const body = await resp.json()
      if (body?.detail) detail = body.detail
    } catch { /* ignore parse error — detail stays as the HTTP status message */ }
    throw new Error(detail)
  }

  const json = await resp.json()
  const elements = json.elements || []
  console.debug('[EcoDistrict OSM] Proxy returned', elements.length, 'raw elements')

  const seen = new Set()
  const out = []
  let skippedNoCoords = 0
  let skippedUnclassified = 0

  for (const el of elements) {
    const tags = el.tags || {}

    // Use a fallback display name — do NOT discard elements only because
    // they lack a name tag. Most Indian waste/recycling nodes are unnamed.
    const name = tags.name || tags['name:en'] || tags['name:hi'] || 'Unnamed facility'

    // Coordinates: nodes have lat/lon directly; ways have a center object
    const elLat = el.lat ?? el.center?.lat
    const elLng = el.lon ?? el.center?.lon
    if (typeof elLat !== 'number' || typeof elLng !== 'number') {
      skippedNoCoords++
      continue
    }

    const entry = classifyOsmElement(tags)
    if (!entry) {
      skippedUnclassified++
      continue
    }

    const id = `osm-${el.type}-${el.id}`
    if (seen.has(id)) continue
    seen.add(id)

    out.push({
      id,
      name,
      label: entry.label,
      color: entry.color,
      address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', '),
      lat: elLat,
      lng: elLng,
      rating: null,
      openNow: null,
      mapsUrl: null,
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      source: 'osm',
    })

    if (out.length >= 100) break   // safety cap — never return huge payloads
  }

  console.debug(
    '[EcoDistrict OSM] Filtering:',
    elements.length, 'raw →',
    elements.length - skippedNoCoords - skippedUnclassified, 'classified →',
    out.length, 'final (after dedup + cap)',
    skippedNoCoords ? `| ${skippedNoCoords} skipped (no coords)` : '',
    skippedUnclassified ? `| ${skippedUnclassified} skipped (unclassified)` : '',
  )

  // Zero results is a valid outcome (sparse OSM data) — return empty array,
  // do NOT throw. The caller handles the empty-results UI separately.
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
