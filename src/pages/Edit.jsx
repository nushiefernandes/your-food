import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEntry, updateEntry } from '../lib/entries'
import { uploadPhoto } from '../lib/storage'
import { usePhotoAnalysis } from '../hooks/usePhotoAnalysis'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { analysis, analyzePhoto, clearAnalysis } = usePhotoAnalysis()

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

  function handlePhotoSelected(file) {
    analyzePhoto(file)
  }

  function handlePhotoClear() {
    clearAnalysis()
  }

  async function handleSubmit(formData) {
    let photoUrl = entry.photo_url
    let photoPath = entry.photo_path

    if (analysis?.uploadResult) {
      photoUrl = analysis.uploadResult.url
      photoPath = analysis.uploadResult.path
    } else if (formData.photoFile) {
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
      recipe_url: formData.recipeUrl,
      prep_time_minutes: formData.prepTime,
      cuisine_type: formData.cuisineType || null,
      photo_url: photoUrl,
      photo_path: photoPath,
      ai_suggestions: analysis?.suggestions || null,
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
        analysis={analysis}
        onPhotoSelected={handlePhotoSelected}
        onPhotoClear={handlePhotoClear}
      />
    </PageShell>
  )
}

export default Edit
