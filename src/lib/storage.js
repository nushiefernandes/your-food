import { supabase } from './supabase'

export async function uploadPhoto(file) {
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('meal-photos')
    .upload(path, file)

  if (uploadError) {
    return { url: null, path: null, error: uploadError }
  }

  const { data } = supabase.storage
    .from('meal-photos')
    .getPublicUrl(path)

  return { url: data.publicUrl, path, error: null }
}

export async function deletePhoto(path) {
  const { error } = await supabase.storage
    .from('meal-photos')
    .remove([path])

  return { error }
}
