import { supabase } from './supabase'

export async function getEntries() {
  return supabase
    .from('entries')
    .select('*')
    .order('ate_at', { ascending: false })
}

export async function getEntry(id) {
  const [entryResult, photosResult] = await Promise.all([
    supabase
      .from('entries')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('entry_photos')
      .select('*')
      .eq('entry_id', id)
      .order('sort_order'),
  ])

  if (entryResult.error) {
    return { data: null, error: entryResult.error }
  }

  return {
    data: { ...entryResult.data, photos: photosResult.data ?? [] },
    error: null,
  }
}

export async function createEntry(entryData, photos = []) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('entries')
    .insert({ ...entryData, user_id: user.id })
    .select()
    .single()

  if (error) {
    return { data, error }
  }

  if (photos.length > 0) {
    const rows = photos.map((p, i) => ({
      entry_id: data.id,
      url: p.url,
      path: p.path,
      gps_lat: p.gps_lat ?? null,
      gps_lng: p.gps_lng ?? null,
      taken_at: p.taken_at ?? null,
      is_primary: i === 0,
      sort_order: i,
    }))

    const { error: photosError } = await supabase
      .from('entry_photos')
      .insert(rows)

    if (photosError) {
      console.error('[entries] failed to insert entry_photos:', photosError)
    }
  }

  return { data, error: null }
}

export async function updateEntry(id, updates, photosToAdd = [], photoIdsToRemove = []) {
  const updateResult = await supabase
    .from('entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateResult.error) {
    return updateResult
  }

  if (photoIdsToRemove.length > 0) {
    await supabase
      .from('entry_photos')
      .delete()
      .in('id', photoIdsToRemove)
  }

  if (photosToAdd.length > 0) {
    const { data: existingPhotos } = await supabase
      .from('entry_photos')
      .select('sort_order')
      .eq('entry_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxSortOrder = existingPhotos?.[0]?.sort_order ?? -1
    const rows = photosToAdd.map((p, i) => ({
      entry_id: id,
      url: p.url,
      path: p.path,
      gps_lat: p.gps_lat ?? null,
      gps_lng: p.gps_lng ?? null,
      taken_at: p.taken_at ?? null,
      is_primary: false,
      sort_order: maxSortOrder + i + 1,
    }))

    await supabase
      .from('entry_photos')
      .insert(rows)
  }

  return updateResult
}

export async function deleteEntry(id) {
  return supabase
    .from('entries')
    .delete()
    .eq('id', id)
}

export async function searchEntries(filters = {}) {
  const textQuery = filters.q?.trim()
  const sortField = filters.sortBy || 'ate_at'
  const ascending = filters.sortAsc === true

  let query = supabase
    .from('entries')
    .select('*')

  if (textQuery) {
    query = query.or(
      `dish_name.ilike.%${textQuery}%,venue_name.ilike.%${textQuery}%,notes.ilike.%${textQuery}%,cuisine_type.ilike.%${textQuery}%,neighbourhood.ilike.%${textQuery}%`
    )
  }

  if (filters.entryType) {
    query = query.eq('entry_type', filters.entryType)
  }

  if (filters.minRating) {
    query = query.gte('rating', filters.minRating)
  }

  if (filters.dateFrom) {
    query = query.gte('ate_at', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('ate_at', filters.dateTo)
  }

  if (filters.cuisine) {
    query = query.ilike('cuisine_type', `%${filters.cuisine}%`)
  }

  if (filters.venue) {
    query = query.ilike('venue_name', `%${filters.venue}%`)
  }

  return await query.order(sortField, { ascending })
}

export async function getDistinctCuisines() {
  const { data, error } = await supabase
    .from('entries')
    .select('cuisine_type')
    .not('cuisine_type', 'is', null)

  if (error || !data) {
    return []
  }

  const uniqueCuisines = [...new Set(
    data
      .map((entry) => entry.cuisine_type?.trim())
      .filter(Boolean)
  )]

  return uniqueCuisines.sort((a, b) => a.localeCompare(b))
}
