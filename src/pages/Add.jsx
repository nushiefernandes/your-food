import { useNavigate } from 'react-router-dom'
import { createEntry } from '../lib/entries'
import { uploadPhoto } from '../lib/storage'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

function Add() {
  const navigate = useNavigate()

  async function handleSubmit(formData) {
    let photoUrl = null
    let photoPath = null

    if (formData.photoFile) {
      const { url, path, error: uploadError } = await uploadPhoto(formData.photoFile)
      if (uploadError) throw uploadError
      photoUrl = url
      photoPath = path
    }

    const { error } = await createEntry({
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
      photo_url: photoUrl,
      photo_path: photoPath,
    })

    if (error) throw error
    navigate('/')
  }

  return (
    <PageShell title="Log a meal" backTo="/">
      <EntryForm onSubmit={handleSubmit} submitLabel="Save entry" />
    </PageShell>
  )
}

export default Add
