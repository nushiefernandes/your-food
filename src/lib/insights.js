import { supabase } from './supabase'

export async function getInsights() {
  const { data, error } = await supabase.functions.invoke('insights')
  if (error) return { data: null, error }
  return { data, error: null }
}
