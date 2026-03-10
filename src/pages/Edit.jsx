import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEntry, updateEntry } from '../lib/entries'
import { deletePhoto } from '../lib/storage'
import { useMultiPhotoAnalysis } from '../hooks/useMultiPhotoAnalysis'
import PageShell from '../components/PageShell'
import EntryForm from '../components/EntryForm'

function Edit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [existingPhotos, setExistingPhotos] = useState([])
  const [photoIdsToRemove, setPhotoIdsToRemove] = useState([])
  const { analysis, analyzePhotos, clearAnalysis, claimUploads } = useMultiPhotoAnalysis()

  useEffect(() => {
    async function fetchEntry() {
      const { data, error } = await getEntry(id)
      if (error) {
        setError(error.message)
      } else {
        setEntry(data)
        setExistingPhotos(data?.photos ?? [])
        setPhotoIdsToRemove([])
      }
      setLoading(false)
    }
    fetchEntry()
  }, [id])

  function handlePhotosSelected(files, exifArray) {
    analyzePhotos(files, exifArray)
  }

  function handlePhotoClear() {
    clearAnalysis()
  }

  async function handleSubmit(formData) {
    const visibleExistingPhotos = existingPhotos.filter((photo) => !photoIdsToRemove.includes(photo.id))
    const newPhotos = (analysis?.uploadResults ?? []).map((result) => ({
      url: result.url,
      path: result.path,
    }))
    const primaryPhoto = visibleExistingPhotos[0] || newPhotos[0] || null
    const pathsToDelete = existingPhotos
      .filter((photo) => photoIdsToRemove.includes(photo.id))
      .map((photo) => photo.path)
      .filter(Boolean)

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
      photo_lat: formData.photoLat,
      photo_lng: formData.photoLng,
      place_id: formData.placeId || null,
      ai_suggestions: analysis?.suggestions || null,
    }

    const { error } = await updateEntry(id, entryData, newPhotos, photoIdsToRemove)

    if (error) throw error

    await Promise.all(pathsToDelete.map((path) => deletePhoto(path)))
    claimUploads()

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
      {existingPhotos.filter((photo) => !photoIdsToRemove.includes(photo.id)).length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-stone-400 mb-2">Existing photos</p>
          <div className="flex flex-wrap gap-2">
            {existingPhotos
              .filter((photo) => !photoIdsToRemove.includes(photo.id))
              .map((photo) => (
                <div key={photo.id} className="relative w-16 h-16">
                  <img src={photo.url} className="w-full h-full object-cover rounded-lg" alt="" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoIdsToRemove((prev) => (
                        prev.includes(photo.id) ? prev : [...prev, photo.id]
                      ))
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >
                    &times;
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      <EntryForm
        initialData={entry}
        onSubmit={handleSubmit}
        submitLabel="Update entry"
        analysis={analysis}
        onPhotosSelected={handlePhotosSelected}
        onPhotoClear={handlePhotoClear}
      />
    </PageShell>
  )
}

export default Edit
