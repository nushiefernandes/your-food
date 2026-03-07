import { supabase } from './supabase'

export async function getEntries() {
  return supabase
    .from('entries')
    .select('*')
    .order('ate_at', { ascending: false })
}

export async function getEntry(id) {
  return supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .single()
}

export async function createEntry(entryData) {
  const { data: { user } } = await supabase.auth.getUser()
  return supabase
    .from('entries')
    .insert({ ...entryData, user_id: user.id })
    .select()
    .single()
}

export async function updateEntry(id, updates) {
  return supabase
    .from('entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
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
