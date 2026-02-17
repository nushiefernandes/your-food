import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEntry, updateEntry } from '../lib/entries'
import { uploadPhoto } from '../lib/storage'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchEntry() {
      const { data, error } = await getEntry(id)
      if (error) {
        setError(error.message)
      } else {
        setEntry(data)
      }
      setLoading(false)
    }
    fetchEntry()
  }, [id])

  async function handleSubmit(formData) {
    let photoUrl = entry.photo_url
    let photoPath = entry.photo_path

    if (formData.photoFile) {
      const { url, path, error: uploadError } = await uploadPhoto(formData.photoFile)
      if (uploadError) throw uploadError
      photoUrl = url
      photoPath = path
    }

    const { error } = await updateEntry(id, {
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
    navigate(`/entry/${id}`)
  }

  if (loading) {
    return (
      <PageShell backTo={`/entry/${id}`} title="Edit entry">
        <p className="text-stone-400 text-center py-8">Loading...</p>
      </PageShell>
    )
  }

  if (error || !entry) {
    return (
      <PageShell backTo="/" title="Edit entry">
        <p className="text-red-500 text-center py-8">
          {error || 'Entry not found'}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell title="Edit entry" backTo={`/entry/${id}`}>
      <EntryForm
        initialData={entry}
        onSubmit={handleSubmit}
        submitLabel="Update entry"
      />
    </PageShell>
  )
}

export default Edit
