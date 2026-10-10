/**
 * hooks/useNearbyFacilities.js — React hook for nearby waste-facility discovery.
 *
 * Provider strategy:
 *  1. Google Places (if VITE_GOOGLE_MAPS_API_KEY is configured)
 *  2. OpenStreetMap / Overpass API (fallback when Google is absent or fails)
 *  3. Both failed → error state with message
 *
 * Exposes:
 *  status        — 'idle' | 'locating' | 'loading' | 'done' | 'error'
 *  facilities    — normalised result array (each item has a `source` field)
 *  provider      — 'google' | 'osm' | null  (which provider returned the results)
 *  googleWarning — non-null string when Google failed and OSM was used instead
 *  error         — human-readable error message (status === 'error')
 *  userLocation  — { lat, lng } | null
 *  search()      — start a new search
 *  reset()       — return to idle
 *
 * Does NOT expose or log the API key at any point.
 */

import { useState, useCallback } from 'react'
import {
  isGoogleMapsConfigured,
  searchNearbyFacilitiesGoogle,
  searchNearbyFacilitiesOSM,
} from '../services/maps'

/**
 * @param {number} [radiusMetres=5000]
 */
export function useNearbyFacilities(radiusMetres = 5000) {
  const [status, setStatus]             = useState('idle')
  const [facilities, setFacilities]     = useState([])
  const [provider, setProvider]         = useState(null)
  const [googleWarning, setGoogleWarning] = useState(null)
  const [error, setError]               = useState(null)
  const [userLocation, setUserLocation] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setFacilities([])
    setProvider(null)
    setGoogleWarning(null)
    setError(null)
    setUserLocation(null)
  }, [])

  const search = useCallback(async () => {
    // ── Step 1: geolocation ───────────────────────────────────────────────────
    if (!navigator.geolocation) {
      setStatus('error')
      setError('Your browser does not support geolocation.')
      return
    }

    setStatus('locating')
    setError(null)
    setFacilities([])
    setProvider(null)
    setGoogleWarning(null)

    let coords
    try {
      coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 60_000,
        })
      })
    } catch (geoErr) {
      const msg =
        geoErr.code === 1
          ? 'Location permission denied. Please allow location access and try again.'
          : geoErr.code === 2
          ? 'Location unavailable. Check your network or GPS signal.'
          : 'Location request timed out. Please try again.'
      setStatus('error')
      setError(msg)
      return
    }

    const { latitude: lat, longitude: lng } = coords.coords
    setUserLocation({ lat, lng })
    setStatus('loading')

    // ── Step 2: try Google Places ─────────────────────────────────────────────
    if (isGoogleMapsConfigured()) {
      try {
        const results = await searchNearbyFacilitiesGoogle(lat, lng, radiusMetres)
        setFacilities(results)
        setProvider('google')
        setStatus('done')
        return
      } catch (gErr) {
        // Google failed — log the error message (never the key), fall through to OSM
        console.warn('[EcoDistrict] Google Places failed, falling back to OSM:', gErr.message)
        setGoogleWarning(
          `Google Places search failed (${gErr.message}). ` +
          'Showing OpenStreetMap results instead — coverage may be incomplete.'
        )
      }
    }

    // ── Step 3: try OSM / Overpass ────────────────────────────────────────────
    try {
      const results = await searchNearbyFacilitiesOSM(lat, lng, radiusMetres)
      setFacilities(results)
      setProvider('osm')
      setStatus('done')
    } catch (osmErr) {
      // Both providers failed
      const googleNote = isGoogleMapsConfigured()
        ? 'Google Places also failed. '
        : 'Google Places is not configured. '
      setStatus('error')
      setError(
        googleNote +
        `OpenStreetMap search also failed: ${osmErr.message}`
      )
    }
  }, [radiusMetres])

  return {
    status,
    facilities,
    provider,
    googleWarning,
    error,
    userLocation,
    search,
    reset,
  }
}
