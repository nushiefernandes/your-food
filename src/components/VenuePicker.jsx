import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaces } from '../hooks/usePlaces'

function VenuePicker({ value, onChange, onPlaceSelect, coords }) {
  const {
    nearbyPlaces,
    savedMatch,
    selectedPlace,
    loading,
    searchByCoords,
    searchByText,
    selectPlace,
    clearSelection,
  } = usePlaces()

  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  // Auto-search when EXIF coords arrive
  useEffect(() => {
    if (coords?.lat != null && coords?.lng != null) {
      searchByCoords(coords.lat, coords.lng)
    }
  }, [coords?.lat, coords?.lng, searchByCoords])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value
      onChange(val)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (val.length >= 3) {
        debounceRef.current = setTimeout(() => {
          searchByText(val)
          setShowDropdown(true)
        }, 400)
      } else {
        setShowDropdown(false)
      }
    },
    [onChange, searchByText]
  )

  const handleSelect = useCallback(
    async (place) => {
      const name = place.name || place.secondary || ''
      onChange(name)
      setShowDropdown(false)
      const saved = await selectPlace(place)
      if (onPlaceSelect) onPlaceSelect(saved)
    },
    [onChange, onPlaceSelect, selectPlace]
  )

  const handleChange = useCallback(() => {
    clearSelection()
    onChange('')
  }, [clearSelection, onChange])

  // Confirmed place state
  if (selectedPlace) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-stone-300 rounded-lg bg-stone-50">
        <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <span className="text-sm text-stone-700 flex-1 truncate">
          {selectedPlace.name}
        </span>
        <button
          type="button"
          onClick={handleChange}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          change
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (nearbyPlaces.length > 0) setShowDropdown(true)
        }}
        placeholder="e.g. Mabrouk, Sarah's house, office party"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Saved match banner */}
      {savedMatch && !selectedPlace && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm text-amber-800 flex-1">
            Back at {savedMatch.name}?
          </span>
          <button
            type="button"
            onClick={() => handleSelect(savedMatch)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => clearSelection()}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            No
          </button>
        </div>
      )}

      {/* Nearby places chips (from EXIF GPS) */}
      {!savedMatch && nearbyPlaces.length > 0 && !showDropdown && coords?.lat != null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {nearbyPlaces.slice(0, 5).map((place) => (
            <button
              key={place.google_place_id || place.name}
              type="button"
              onClick={() => handleSelect(place)}
              className="text-xs px-2.5 py-1 bg-stone-100 text-stone-600 rounded-full hover:bg-stone-200 transition-colors truncate max-w-[200px]"
            >
              {place.name}
            </button>
          ))}
        </div>
      )}

      {/* Autocomplete dropdown */}
      {showDropdown && nearbyPlaces.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {nearbyPlaces.map((place) => (
            <button
              key={place.google_place_id || place.name}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
            >
              <span className="text-sm text-stone-700 block truncate">
                {place.name}
              </span>
              {place.secondary && (
                <span className="text-xs text-stone-400 block truncate">
                  {place.secondary}
                </span>
              )}
              {place.address && !place.secondary && (
                <span className="text-xs text-stone-400 block truncate">
                  {place.address}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default VenuePicker
