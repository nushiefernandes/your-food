import { useState } from 'react'
import PhotoUpload from './PhotoUpload'
import StarRating from './StarRating'

function toDatetimeLocal(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function EntryForm({ initialData, onSubmit, submitLabel }) {
  const [photoFile, setPhotoFile] = useState(null)
  const [dishName, setDishName] = useState(initialData?.dish_name || '')
  const [entryType, setEntryType] = useState(initialData?.entry_type || 'eating_out')
  const [venueName, setVenueName] = useState(initialData?.venue_name || '')
  const [ateAt, setAteAt] = useState(
    toDatetimeLocal(initialData?.ate_at || new Date())
  )
  const [cost, setCost] = useState(initialData?.cost?.toString() || '')
  const [companions, setCompanions] = useState(initialData?.companions || '')
  const [rating, setRating] = useState(initialData?.rating || null)
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!dishName.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        photoFile,
        dishName: dishName.trim(),
        entryType,
        venueName: entryType === 'eating_out' ? venueName.trim() : '',
        ateAt: new Date(ateAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        cost: cost ? parseFloat(cost) : null,
        companions: companions.trim(),
        rating,
        notes: notes.trim(),
      })
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PhotoUpload
        existingUrl={initialData?.photo_url}
        onFileSelect={setPhotoFile}
        onClear={() => setPhotoFile(null)}
      />

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          What did you eat? *
        </label>
        <input
          type="text"
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          placeholder="e.g. Chicken biryani"
          required
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Meal type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntryType('eating_out')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              entryType === 'eating_out'
                ? 'bg-stone-900 text-white'
                : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            Eating out
          </button>
          <button
            type="button"
            onClick={() => setEntryType('home_cooked')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              entryType === 'home_cooked'
                ? 'bg-stone-900 text-white'
                : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            Home cooked
          </button>
        </div>
      </div>

      {entryType === 'eating_out' && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Where did you eat?
          </label>
          <input
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="e.g. Mabrouk, Sarah's house, office party"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          When did you eat?
        </label>
        <input
          type="datetime-local"
          value={ateAt}
          onChange={(e) => setAteAt(e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Cost
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Who did you eat with?
        </label>
        <input
          type="text"
          value={companions}
          onChange={(e) => setCompanions(e.target.value)}
          placeholder="e.g. Mom, Dad"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Rating
        </label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any thoughts about this meal?"
          rows={3}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white resize-none"
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !dishName.trim()}
        className="w-full py-3 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  )
}

export default EntryForm
