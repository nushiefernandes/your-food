import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEntry, updateEntry } from '../lib/entries'
import { uploadPhoto } from '../lib/storage'
import { fetchWeather } from '../lib/weather'
import { useMultiPhotoAnalysis } from '../hooks/useMultiPhotoAnalysis'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

async function fetchWeatherAndNeighbourhood(entryId, lat, lng, ateAt) {
  try {
    const updates = {}

    const weather = await fetchWeather(lat, lng, ateAt)
    if (weather) updates.weather = weather

    // Reverse geocode via Nominatim (free, no key)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
        {
          headers: { 'User-Agent': 'YourFood/1.0' },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (res.ok) {
        const geo = await res.json()
        const parts = [
          geo.address?.suburb || geo.address?.neighbourhood || geo.address?.quarter,
          geo.address?.city || geo.address?.town || geo.address?.village,
        ].filter(Boolean)
        if (parts.length > 0) updates.neighbourhood = parts.join(', ')
      }
    } catch {
      // Nominatim failed — skip neighbourhood
    }

    if (Object.keys(updates).length > 0) {
      await updateEntry(entryId, updates)
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Add] weather/neighbourhood failed:', err?.message)
  }
}

function Add() {
  const navigate = useNavigate()
  const [primaryExif, setPrimaryExif] = useState(null)
  const { analysis, analyzePhotos, clearAnalysis, claimUploads } = useMultiPhotoAnalysis()

  function handlePhotosSelected(files, exifArray) {
    setPrimaryExif(exifArray?.[0] ?? null)
    analyzePhotos(files, exifArray)
  }

  function handlePhotoClear() {
    setPrimaryExif(null)
    clearAnalysis()
  }

  async function handleSubmit(formData) {
    const primaryLat = primaryExif?.gps_lat ?? primaryExif?.lat ?? null
    const primaryLng = primaryExif?.gps_lng ?? primaryExif?.lng ?? null
    const primaryTakenAt = primaryExif?.timestamp ?? null
    let allPhotos = []

    if (analysis?.uploadResults?.length > 0) {
      allPhotos = analysis.uploadResults.map((result, i) => ({
        url: result.url,
        path: result.path,
        gps_lat: i === 0 ? primaryLat : null,
        gps_lng: i === 0 ? primaryLng : null,
        taken_at: i === 0 ? primaryTakenAt : null,
      }))
    } else if (formData.photoFiles?.length > 0) {
      const { url, path, error: uploadError } = await uploadPhoto(formData.photoFiles[0])
      if (uploadError) throw uploadError
      allPhotos = [{
        url,
        path,
        gps_lat: primaryLat,
        gps_lng: primaryLng,
        taken_at: primaryTakenAt,
      }]
    }

    const entryData = {
      dish_name: formData.dishName,
      venue_name: formData.venueName || null,
      entry_type: formData.entryType,
      cost: formData.cost,
      companions: formData.companions || null,
      rating: formData.rating,
      notes: formData.notes || null,
      is_combo: formData.isCombo,
      ate_at: formData.ateAt,
      timezone: formData.timezone,
      recipe_url: formData.recipeUrl,
      prep_time_minutes: formData.prepTime,
      cuisine_type: formData.cuisineType || null,
      photo_url: allPhotos[0]?.url ?? null,
      photo_path: allPhotos[0]?.path ?? null,
      photo_lat: primaryLat,
      photo_lng: primaryLng,
      place_id: formData.placeId || null,
      ai_suggestions: analysis?.suggestions || null,
    }

    const { data: entry, error } = await createEntry(entryData, allPhotos)

    if (!error) claimUploads()

    if (error) throw error

    // Fire-and-forget: weather + neighbourhood (never blocks navigation)
    if (entry?.id && primaryLat && primaryLng) {
      fetchWeatherAndNeighbourhood(entry.id, primaryLat, primaryLng, formData.ateAt)
    }

    navigate('/?saved=1')
  }

  return (
    <PageShell title="Log a meal" backTo="/">
      <EntryForm
        onSubmit={handleSubmit}
        submitLabel="Save entry"
        analysis={analysis}
        onPhotosSelected={handlePhotosSelected}
        onPhotoClear={handlePhotoClear}
      />
    </PageShell>
  )
}

export default Add
