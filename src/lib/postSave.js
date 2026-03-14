import { supabase } from './supabase'

export async function getPostSaveData(entryId) {
  return supabase.functions.invoke('post-save', { body: { entryId } })
}
