import { supabase } from './supabase'
import { haversineMeters } from './geo'

const TIMEOUT_MS = 10000

async function invokePlaces(body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { data, error } = await supabase.functions.invoke('places', {
      body,
      signal: controller.signal,
    })

    if (error || data?.error) {
      if (import.meta.env.DEV) {
        console.error('[places] Edge Function error:', { error, dataError: data?.error })
      }
      return { data: null, error: data?.error || 'api_error' }
    }

    return { data, error: null }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { data: null, error: 'timeout' }
    }
    if (import.meta.env.DEV) console.error('[places] invoke failed:', err)
    return { data: null, error: 'api_error' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function searchNearby(lat, lng, radius = 100) {
  const { data } = await invokePlaces({ type: 'nearby', lat, lng, radius })
  return data?.places ?? []
}

export async function autocompletePlace(input, lat, lng) {
  const { data } = await invokePlaces({ type: 'autocomplete', input, lat, lng })
  return data?.predictions ?? []
}

export async function getPlaceDetails(placeId) {
  const { data } = await invokePlaces({ type: 'details', place_id: placeId })
  return data?.place ?? null
}

export async function getSavedPlaces() {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false })

  if (error && import.meta.env.DEV) console.error('[places] getSavedPlaces error:', error)
  return data ?? []
}

export async function savePlace(placeData) {
  // getSession() reads from cache — no network round-trip. RLS enforces actual auth.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data } = await supabase
    .from('places')
    .upsert({ ...placeData, user_id: session.user.id }, { onConflict: 'user_id,google_place_id' })
    .select()
    .single()

  return data
}

export function findNearbyPlace(lat, lng, savedPlaces, radiusMeters = 50) {
  if (!Array.isArray(savedPlaces) || savedPlaces.length === 0) return null

  for (const place of savedPlaces) {
    if (typeof place?.lat !== 'number' || typeof place?.lng !== 'number') continue

    const distance = haversineMeters(lat, lng, place.lat, place.lng)
    if (distance <= radiusMeters) return place
  }

  return null
}
