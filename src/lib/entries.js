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
