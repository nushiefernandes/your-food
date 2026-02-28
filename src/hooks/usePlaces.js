import { useCallback, useRef, useState } from 'react'
import {
  searchNearby,
  autocompletePlace,
  getPlaceDetails,
  getSavedPlaces,
  savePlace,
  findNearbyPlace,
} from '../lib/places'

export function usePlaces() {
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [savedMatch, setSavedMatch] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [loading, setLoading] = useState(false)
  const coordsRef = useRef(null)
  const requestIdRef = useRef(0)

  const searchByCoords = useCallback(async (lat, lng) => {
    coordsRef.current = { lat, lng }
    const reqId = ++requestIdRef.current
    setLoading(true)
    try {
      const saved = await getSavedPlaces()
      if (requestIdRef.current !== reqId) return
      const match = findNearbyPlace(lat, lng, saved, 50)
      if (match) {
        setSavedMatch(match)
        setNearbyPlaces([])
        return
      }
      const places = await searchNearby(lat, lng)
      if (requestIdRef.current !== reqId) return
      setNearbyPlaces(places)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[usePlaces] searchByCoords:', err)
    } finally {
      if (requestIdRef.current === reqId) setLoading(false)
    }
  }, [])

  const searchByText = useCallback(async (query) => {
    if (!query || query.length < 3) return
    const reqId = ++requestIdRef.current
    setLoading(true)
    try {
      const coords = coordsRef.current
      const predictions = await autocompletePlace(
        query,
        coords?.lat ?? null,
        coords?.lng ?? null
      )
      if (requestIdRef.current !== reqId) return
      setNearbyPlaces(predictions)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[usePlaces] searchByText:', err)
    } finally {
      if (requestIdRef.current === reqId) setLoading(false)
    }
  }, [])

  const selectPlace = useCallback(async (place) => {
    setSelectedPlace(place)
    setNearbyPlaces([])
    setSavedMatch(null)

    if (place.google_place_id && !place.lat) {
      try {
        const details = await getPlaceDetails(place.google_place_id)
        if (details) {
          const full = { ...place, ...details }
          setSelectedPlace(full)
          const saved = await savePlace({
            google_place_id: full.google_place_id,
            name: full.name,
            lat: full.lat,
            lng: full.lng,
            address: full.address ? { formatted: full.address } : null,
          })
          return saved
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[usePlaces] selectPlace:', err)
      }
    } else if (place.google_place_id) {
      try {
        const saved = await savePlace({
          google_place_id: place.google_place_id,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          address: place.address ? { formatted: place.address } : null,
        })
        return saved
      } catch (err) {
        if (import.meta.env.DEV) console.error('[usePlaces] savePlace:', err)
      }
    }
    return place
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPlace(null)
    setSavedMatch(null)
    setNearbyPlaces([])
  }, [])

  return {
    nearbyPlaces,
    savedMatch,
    selectedPlace,
    loading,
    searchByCoords,
    searchByText,
    selectPlace,
    clearSelection,
  }
}
