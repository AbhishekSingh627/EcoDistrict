// WasteMap page — OpenStreetMap map with three views:
//   Registered   — real locations from the backend database (live)
//   Sample        — static reference locations for UI preview (clearly labelled)
//   Find Nearby   — live OSM/Google Places search from user's GPS location
//
// Do NOT modify: ScanWaste, backend routes, or the ML classifier.
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet'
import { icon as LeafletIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import DemoBanner from '../components/DemoBanner'
import { SAMPLE_LOCATIONS, LOCATION_TYPES, TYPE_COLORS } from '../data/sampleLocations'
import { FACILITY_COLORS, FACILITY_LABELS } from '../services/maps'
import { useNearbyFacilities } from '../hooks/useNearbyFacilities'
import {
  Search,
  Filter,
  MapPin,
  ExternalLink,
  Loader2,
  AlertCircle,
  Navigation,
  RefreshCw,
} from 'lucide-react'

// Fix default Leaflet marker icon paths broken by bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// ── Marker helpers ─────────────────────────────────────────────────────────────

function makeIcon(color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.75 14 22 14 22S28 23.75 28 14C28 6.27 21.73 0 14 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>
  `)
  return LeafletIcon({
    iconUrl: `data:image/svg+xml,${svg}`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

// Pre-build icons for demo categories
const DEMO_ICONS = Object.fromEntries(
  Object.entries(TYPE_COLORS).map(([type, color]) => [type, makeIcon(color)])
)

// Pre-build icons for facility categories
const FACILITY_ICONS = Object.fromEntries(
  Object.entries(FACILITY_COLORS).map(([label, color]) => [label, makeIcon(color)])
)

const defaultIcon = LeafletIcon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// User location marker (blue)
const userIcon = makeIcon('#0ea5e9')

// Ahmedabad city centre — used as the default map view.
// Demo sample locations use Delhi coordinates and are clearly labelled.
const MAP_CENTER = [23.0225, 72.5714]

// ── Small Leaflet helper: re-centre map when userLocation changes ──────────────
function RecenterMap({ lat, lng }) {
  const map = useMap()
  map.setView([lat, lng], 14)
  return null
}

// ── Tab constants ──────────────────────────────────────────────────────────────
const TAB_REGISTERED = 'registered'
const TAB_DEMO       = 'sample'
const TAB_NEARBY     = 'nearby'

// ── Main component ─────────────────────────────────────────────────────────────
export default function WasteMap() {
  // Active tab
  const [activeTab, setActiveTab] = useState(TAB_REGISTERED)

  // ── Registered locations (from backend) ─────────────────────────────────────
  // Start in 'loading' so the effect fires immediately on mount without needing
  // to call setRegStatus('loading') inside the effect body (avoids the
  // set-state-in-effect lint warning).
  const [regLocations, setRegLocations]   = useState([])
  const [regStatus, setRegStatus]         = useState('loading') // loading | done | error
  const [regError, setRegError]           = useState(null)
  const [regSelected, setRegSelected]     = useState(null)
  const [regSearch, setRegSearch]         = useState('')
  const [regFilters, setRegFilters]       = useState(new Set())

  useEffect(() => {
    if (regStatus !== 'loading') return
    const controller = new AbortController()
    fetch('/api/locations/', { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`)
        return r.json()
      })
      .then(data => {
        setRegLocations(data)
        // Seed filter set from whatever types actually exist in the data
        setRegFilters(new Set(data.map(l => l.location_type)))
        setRegStatus('done')
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setRegError(err.message)
        setRegStatus('error')
      })
    return () => controller.abort()
  }, [regStatus])

  function retryReg() {
    setRegStatus('loading')
    setRegError(null)
  }

  function toggleRegFilter(type) {
    setRegFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) { next.delete(type) } else { next.add(type) }
      return next
    })
  }

  const regTypes = [...new Set(regLocations.map(l => l.location_type))]

  const visibleReg = regLocations.filter(loc => {
    const matchSearch =
      loc.name.toLowerCase().includes(regSearch.toLowerCase()) ||
      (loc.address || '').toLowerCase().includes(regSearch.toLowerCase())
    return matchSearch && regFilters.has(loc.location_type)
  })

  // ── Demo tab state ────────────────────────────────────────────────────────────
  const [search, setSearch]               = useState('')
  const [activeFilters, setActiveFilters] = useState(new Set(LOCATION_TYPES))
  const [selected, setSelected]           = useState(null)

  // Nearby facilities state (from hook)
  const {
    status, facilities, provider, googleWarning,
    error, userLocation, search: findNearby, reset,
  } = useNearbyFacilities(5000)

  // Nearby label filter
  const [nearbyFilters, setNearbyFilters] = useState(new Set(FACILITY_LABELS))

  function toggleDemoFilter(type) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) { next.delete(type) } else { next.add(type) }
      return next
    })
  }

  function toggleNearbyFilter(label) {
    setNearbyFilters(prev => {
      const next = new Set(prev)
      if (next.has(label)) { next.delete(label) } else { next.add(label) }
      return next
    })
  }

  // Filtered demo locations
  const visibleDemo = SAMPLE_LOCATIONS.filter(loc => {
    const matchSearch = loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.address.toLowerCase().includes(search.toLowerCase())
    return matchSearch && activeFilters.has(loc.type)
  })

  // Filtered nearby facilities
  const visibleNearby = facilities.filter(f => nearbyFilters.has(f.label))

  // Map centre: follow user location when acquired, otherwise Ahmedabad default
  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : MAP_CENTER

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Waste Map — Ahmedabad</h1>
        <p className="text-sm text-slate-500 mb-3">
          Locate registered recycling and waste-management facilities in Ahmedabad.
        </p>

        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-3">
          <button
            onClick={() => setActiveTab(TAB_REGISTERED)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === TAB_REGISTERED
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Registered
          </button>
          <button
            onClick={() => setActiveTab(TAB_DEMO)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === TAB_DEMO
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sample Locations
          </button>
          <button
            onClick={() => setActiveTab(TAB_NEARBY)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === TAB_NEARBY
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Navigation size={13} />
            Find Nearby
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 px-6 pb-6 min-h-0">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* ═══════════════ REGISTERED TAB SIDEBAR ══════════════════════ */}
          {activeTab === TAB_REGISTERED && (
            <>
              {/* Loading */}
              {regStatus === 'loading' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
                  <Loader2 size={18} className="text-green-600 animate-spin shrink-0" />
                  <p className="text-sm text-slate-600">Loading registered facilities…</p>
                </div>
              )}

              {/* Error */}
              {regStatus === 'error' && (
                <div className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="text-sm">Could not load locations: {regError}</p>
                  </div>
                  <button
                    onClick={retryReg}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              )}

              {/* Done — empty database */}
              {regStatus === 'done' && regLocations.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                  <MapPin size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600 mb-1">No facilities registered yet</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Verified Ahmedabad waste-management facilities will appear here once they are added to the database via the admin API.
                  </p>
                </div>
              )}

              {/* Done — results */}
              {regStatus === 'done' && regLocations.length > 0 && (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search facilities…"
                      value={regSearch}
                      onChange={e => setRegSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>

                  {/* Filters (only if multiple types exist) */}
                  {regTypes.length > 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Filter size={14} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filter by Type</span>
                      </div>
                      <div className="space-y-2">
                        {regTypes.map(type => (
                          <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={regFilters.has(type)}
                              onChange={() => toggleRegFilter(type)}
                              className="sr-only"
                            />
                            <span
                              className="w-4 h-4 rounded border-2 border-green-500 flex items-center justify-center transition-colors"
                              style={{ backgroundColor: regFilters.has(type) ? '#16a34a' : 'transparent' }}
                            >
                              {regFilters.has(type) && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            <span className="text-sm text-slate-600 group-hover:text-slate-800">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location list */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {visibleReg.length} facility{visibleReg.length !== 1 ? 'ies' : 'y'} shown
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {visibleReg.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">No facilities match your filters.</p>
                      ) : visibleReg.map(loc => (
                        <button
                          key={loc.id}
                          onClick={() => setRegSelected(loc)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${regSelected?.id === loc.id ? 'bg-green-50' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-600" />
                            <span className="text-sm font-medium text-slate-700 truncate">{loc.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 ml-4.5 truncate">{loc.location_type}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══════════════ SAMPLE TAB SIDEBAR ═════════════════════════ */}
          {activeTab === TAB_DEMO && (
            <>
              <DemoBanner message="Preview Mode — these are illustrative sample locations (Delhi coordinates) used to demonstrate the map UI. They are not real Ahmedabad facilities. Use the Registered tab or Find Nearby for live data." />

              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search locations…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={14} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filter by Type</span>
                </div>
                <div className="space-y-2">
                  {LOCATION_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={activeFilters.has(type)}
                        onChange={() => toggleDemoFilter(type)}
                        className="sr-only"
                      />
                      <span
                        className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                        style={{
                          borderColor: TYPE_COLORS[type],
                          backgroundColor: activeFilters.has(type) ? TYPE_COLORS[type] : 'transparent',
                        }}
                      >
                        {activeFilters.has(type) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-slate-600 group-hover:text-slate-800">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location list */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {visibleDemo.length} location{visibleDemo.length !== 1 ? 's' : ''} shown
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {visibleDemo.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No locations match your filters.</p>
                  ) : visibleDemo.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => setSelected(loc)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.id === loc.id ? 'bg-green-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[loc.type] }} />
                        <span className="text-sm font-medium text-slate-700 truncate">{loc.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 ml-4.5 truncate">{loc.type}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Legend</p>
                <div className="space-y-1.5">
                  {LOCATION_TYPES.map(type => (
                    <div key={type} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                      {type}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══════════════ NEARBY TAB SIDEBAR ══════════════════════════ */}
          {activeTab === TAB_NEARBY && (
            <>
              {/* ── Idle — always show the search button ───────────────── */}
              {status === 'idle' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Find waste-management facilities near your current location.
                  </p>
                  <p className="text-xs text-slate-400">
                    Search radius: 5 km · Uses Google Places when configured, otherwise OpenStreetMap
                  </p>
                  <button
                    onClick={findNearby}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Navigation size={15} />
                    Find Nearby Facilities
                  </button>
                </div>
              )}

              {/* ── Locating ───────────────────────────────────────────── */}
              {status === 'locating' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
                  <Loader2 size={18} className="text-green-600 animate-spin shrink-0" />
                  <p className="text-sm text-slate-600">Requesting your location…</p>
                </div>
              )}

              {/* ── Loading ────────────────────────────────────────────── */}
              {status === 'loading' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
                  <Loader2 size={18} className="text-green-600 animate-spin shrink-0" />
                  <p className="text-sm text-slate-600">Searching nearby facilities…</p>
                </div>
              )}

              {/* ── Error ──────────────────────────────────────────────── */}
              {status === 'error' && (
                <div className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <RefreshCw size={12} /> Try again
                  </button>
                </div>
              )}

              {/* ── Results ────────────────────────────────────────────── */}
              {status === 'done' && (
                <>
                  {/* Provider + fallback notice */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        provider === 'google'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {provider === 'google' ? '📍 Google Places' : '🗺 OpenStreetMap'}
                      </span>
                      <button
                        onClick={reset}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                      >
                        <RefreshCw size={11} /> New search
                      </button>
                    </div>
                    {googleWarning && (
                      <div className="flex items-start gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <p className="text-xs leading-relaxed">{googleWarning}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">
                      Coverage may be incomplete. Results are from a third-party data source, not verified by EcoDistrict.
                    </p>
                  </div>

                  {/* Category filters */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter size={14} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category</span>
                    </div>
                    <div className="space-y-2">
                      {FACILITY_LABELS.map(label => (
                        <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={nearbyFilters.has(label)}
                            onChange={() => toggleNearbyFilter(label)}
                            className="sr-only"
                          />
                          <span
                            className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                            style={{
                              borderColor: FACILITY_COLORS[label],
                              backgroundColor: nearbyFilters.has(label) ? FACILITY_COLORS[label] : 'transparent',
                            }}
                          >
                            {nearbyFilters.has(label) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="text-sm text-slate-600 group-hover:text-slate-800">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Results list */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {visibleNearby.length} facilit{visibleNearby.length !== 1 ? 'ies' : 'y'} found
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {visibleNearby.length === 0 ? (
                        <div className="text-center py-8 px-4">
                          <MapPin size={24} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No facilities found in this category within 5 km.</p>
                          <p className="text-xs text-slate-300 mt-1">Try a different location or expand filters.</p>
                        </div>
                      ) : visibleNearby.map(f => (
                        <div key={f.id} className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: f.color }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{f.address}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span
                                  className="inline-block text-xs px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: f.color }}
                                >
                                  {f.label}
                                </span>
                                {/* Source badge */}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  f.source === 'google'
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-orange-50 text-orange-600'
                                }`}>
                                  {f.source === 'google' ? 'Google' : 'OSM'}
                                </span>
                                {f.openNow === true && (
                                  <span className="text-xs text-green-600 font-medium">Open now</span>
                                )}
                                {f.openNow === false && (
                                  <span className="text-xs text-red-500">Closed</span>
                                )}
                                {f.rating && (
                                  <span className="text-xs text-slate-400">★ {f.rating}</span>
                                )}
                              </div>
                              {f.mapsUrl && (
                                <a
                                  href={f.mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1.5"
                                >
                                  <ExternalLink size={11} />
                                  Open in Google Maps
                                </a>
                              )}
                              {f.osmUrl && (
                                <a
                                  href={f.osmUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 mt-1.5"
                                >
                                  <ExternalLink size={11} />
                                  View on OpenStreetMap
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm min-h-96">
          <MapContainer
            center={mapCenter}
            zoom={activeTab === TAB_REGISTERED ? 12 : 13}
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />

            {/* Re-centre when user location is acquired */}
            {userLocation && (
              <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />
            )}

            {/* ── Registered tab: backend location markers ──────────── */}
            {activeTab === TAB_REGISTERED && visibleReg.map(loc => (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
                icon={defaultIcon}
              >
                <Popup maxWidth={240}>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800 mb-1">{loc.name}</p>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-600 text-white mb-2">
                      {loc.location_type}
                    </span>
                    {loc.address && <p className="text-xs text-slate-500 mb-1">{loc.address}</p>}
                    {loc.description && <p className="text-xs text-slate-400 mb-1">{loc.description}</p>}
                    {loc.accepted_waste && (
                      <>
                        <p className="text-xs font-medium text-slate-600 mt-1">Accepts:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {loc.accepted_waste.split(',').map(a => a.trim()).filter(Boolean).map(a => (
                            <span key={a} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{a}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* ── Demo tab: sample markers ───────────────────────────── */}
            {activeTab === TAB_DEMO && visibleDemo.map(loc => (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={DEMO_ICONS[loc.type] || defaultIcon}
              >
                <Popup maxWidth={220}>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800 mb-1">{loc.name}</p>
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded-full text-white mb-2"
                      style={{ backgroundColor: TYPE_COLORS[loc.type] }}
                    >
                      {loc.type}
                    </span>
                    <p className="text-xs text-slate-500 mb-2">{loc.address}</p>
                    <p className="text-xs font-medium text-slate-600">Accepts:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {loc.accepted.map(a => (
                        <span key={a} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                    <p className="text-xs text-amber-600 mt-2 italic">⚠ Sample / preview location — not verified</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* ── Nearby tab: user location marker ──────────────────── */}
            {activeTab === TAB_NEARBY && userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userIcon}
              >
                <Popup>
                  <p className="text-sm font-semibold text-slate-700">Your location</p>
                </Popup>
              </Marker>
            )}

            {/* ── Nearby tab: facility markers ──────────────────────── */}
            {activeTab === TAB_NEARBY && visibleNearby.map(f => (
              <Marker
                key={f.id}
                position={[f.lat, f.lng]}
                icon={FACILITY_ICONS[f.label] || defaultIcon}
              >
                <Popup maxWidth={240}>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800 mb-1">{f.name}</p>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: f.color }}
                      >
                        {f.label}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        f.source === 'google'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-orange-50 text-orange-600'
                      }`}>
                        {f.source === 'google' ? 'Google Places' : 'OpenStreetMap'}
                      </span>
                    </div>
                    {f.address && <p className="text-xs text-slate-500 mb-1">{f.address}</p>}
                    {f.openNow === true  && <p className="text-xs text-green-600 font-medium">Open now</p>}
                    {f.openNow === false && <p className="text-xs text-red-500">Closed</p>}
                    {f.rating && <p className="text-xs text-slate-400 mt-0.5">★ {f.rating}</p>}
                    {f.mapsUrl && (
                      <a
                        href={f.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-blue-600 hover:underline mt-2"
                      >
                        Open in Google Maps ↗
                      </a>
                    )}
                    {f.osmUrl && (
                      <a
                        href={f.osmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-orange-600 hover:underline mt-1"
                      >
                        View on OpenStreetMap ↗
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
