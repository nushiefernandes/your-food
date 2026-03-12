import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEntry, updateEntry } from '../lib/entries'
import { useMultiPhotoAnalysis } from '../hooks/useMultiPhotoAnalysis'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { photos, processing, processingError, analysis, addFiles, removePhoto, clearAll, seedExistingPhotos, claimUploads } = useMultiPhotoAnalysis()

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

  useEffect(() => {
    if (entry?.photos?.length && photos.length === 0) {
      seedExistingPhotos(entry.photos.map(p => ({ url: p.url, path: p.path })))
    }
  }, [entry?.id])

  async function handleSubmit(formData) {
    const primaryExif = photos[0]?.exif ?? null
    const existingPhotos = entry?.photos ?? []
    const existingPathSet = new Set(existingPhotos.map((photo) => photo.path).filter(Boolean))

    const fallbackResults = photos
      .filter((photo) => photo.rawFile === null)
      .map((photo) => existingPhotos.find((existingPhoto) => existingPhoto.url === photo.previewUrl))
      .filter(Boolean)
      .map((photo) => ({ url: photo.url, path: photo.path }))

    const currentResults = analysis?.uploadResults?.length > 0
      ? analysis.uploadResults
      : fallbackResults

    const currentPathSet = new Set(currentResults.map((result) => result.path).filter(Boolean))
    const photoIdsToRemove = existingPhotos
      .filter((photo) => !currentPathSet.has(photo.path))
      .map((photo) => photo.id)

    const newPhotos = currentResults
      .filter((result) => !existingPathSet.has(result.path))
      .map((result) => ({
      url: result.url,
      path: result.path,
    }))
    const primaryPhoto = currentResults[0] || null

    const entryData = {
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
      photo_url: primaryPhoto?.url ?? null,
      photo_path: primaryPhoto?.path ?? null,
      photo_lat: primaryExif?.lat ?? null,
      photo_lng: primaryExif?.lng ?? null,
      place_id: formData.placeId || null,
      ai_suggestions: analysis?.suggestions || null,
    }

    const { error } = await updateEntry(id, entryData, newPhotos, photoIdsToRemove)

    if (error) throw error
    claimUploads()

    navigate('/saved', { state: { returnTo: `/entry/${id}` } })
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
        photos={photos}
        processing={processing}
        processingError={processingError}
        onFilesAdded={addFiles}
        onPhotoRemoved={removePhoto}
        onPhotoClear={clearAll}
      />
    </PageShell>
  )
}

export default Edit
