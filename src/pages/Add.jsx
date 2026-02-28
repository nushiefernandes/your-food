import { useNavigate } from 'react-router-dom'
import { createEntry, updateEntry } from '../lib/entries'
import { uploadPhoto } from '../lib/storage'
import { fetchWeather } from '../lib/weather'
import { usePhotoAnalysis } from '../hooks/usePhotoAnalysis'
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
  const { analysis, analyzePhoto, clearAnalysis, claimUpload } = usePhotoAnalysis()

  function handlePhotoSelected(file, orientation) {
    analyzePhoto(file, orientation)
  }

  function handlePhotoClear() {
    clearAnalysis()
  }

  async function handleSubmit(formData) {
    let photoUrl = null
    let photoPath = null

    if (analysis?.uploadResult) {
      photoUrl = analysis.uploadResult.url
      photoPath = analysis.uploadResult.path
      claimUpload()
    } else if (formData.photoFile) {
      const { url, path, error: uploadError } = await uploadPhoto(formData.photoFile)
      if (uploadError) throw uploadError
      photoUrl = url
      photoPath = path
    }

    const { data: entry, error } = await createEntry({
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
      photo_url: photoUrl,
      photo_path: photoPath,
      photo_lat: formData.photoLat,
      photo_lng: formData.photoLng,
      place_id: formData.placeId || null,
      ai_suggestions: analysis?.suggestions || null,
    })

    if (error) throw error

    // Fire-and-forget: weather + neighbourhood (never blocks navigation)
    if (entry?.id && formData.photoLat && formData.photoLng) {
      fetchWeatherAndNeighbourhood(entry.id, formData.photoLat, formData.photoLng, formData.ateAt)
    }

    navigate('/?saved=1')
  }

  return (
    <PageShell title="Log a meal" backTo="/">
      <EntryForm
        onSubmit={handleSubmit}
        submitLabel="Save entry"
        analysis={analysis}
        onPhotoSelected={handlePhotoSelected}
        onPhotoClear={handlePhotoClear}
      />
    </PageShell>
  )
}

export default Add
