import { useEffect, useMemo, useRef, useState } from 'react'
import PhotoUpload from './PhotoUpload'
import StarRating from './StarRating'

const EATING_OUT_PROMPTS = [
  'Worth going back?',
  'Any surprises on the menu?',
  'Better than last time?',
  'How did you find this place?',
  'Would you order this again?',
  'Who should you bring here next time?',
]

const HOME_COOKED_PROMPTS = [
  'Would you make this again?',
  'What would you change next time?',
  'Where did you get the recipe?',
  'How long did it take?',
  'Any ingredient substitutions?',
  'Who helped you cook?',
]

function getRandomItem(items) {
  if (!items?.length) return ''
  return items[Math.floor(Math.random() * items.length)]
}

function toDatetimeLocal(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function EntryForm({ initialData, onSubmit, submitLabel, analysis, onPhotoSelected, onPhotoClear }) {
  const [photoFile, setPhotoFile] = useState(null)
  const [dishName, setDishName] = useState(initialData?.dish_name || '')
  const [entryType, setEntryType] = useState(initialData?.entry_type || 'eating_out')
  const [isCombo, setIsCombo] = useState(initialData?.is_combo || false)
  const [showMore, setShowMore] = useState(initialData?.is_combo || false)
  const [venueName, setVenueName] = useState(initialData?.venue_name || '')
  const [cuisineType, setCuisineType] = useState(initialData?.cuisine_type || '')
  const [recipeUrl, setRecipeUrl] = useState(initialData?.recipe_url || '')
  const [prepTime, setPrepTime] = useState(
    initialData?.prep_time_minutes?.toString() || ''
  )
  const [ateAt, setAteAt] = useState(
    toDatetimeLocal(initialData?.ate_at || new Date())
  )
  const [cost, setCost] = useState(initialData?.cost?.toString() || '')
  const [companions, setCompanions] = useState(initialData?.companions || '')
  const [rating, setRating] = useState(initialData?.rating || null)
  const [notes, setNotes] = useState(initialData?.notes || '')
  const userTouchedEntryType = useRef(!!initialData?.entry_type)
  const [aiVisible, setAiVisible] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const notesPlaceholder = useMemo(() => {
    const prompts =
      entryType === 'home_cooked' ? HOME_COOKED_PROMPTS : EATING_OUT_PROMPTS
    return getRandomItem(prompts)
  }, [entryType])

  useEffect(() => {
    if (analysis?.status !== 'done' || !analysis?.suggestions) return
    const s = analysis.suggestions
    if (s.dish_name && !dishName) setDishName(s.dish_name)
    if (s.cuisine_type && !cuisineType) setCuisineType(s.cuisine_type)
    if (s.entry_type && !userTouchedEntryType.current && (s.entry_type === 'eating_out' || s.entry_type === 'home_cooked')) {
      setEntryType(s.entry_type)
    }
    setAiVisible(new Set(analysis.aiFields))
  }, [analysis?.status, analysis?.suggestions])

  function clearAiBadge(field) {
    setAiVisible((prev) => {
      if (!prev.has(field)) return prev
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!dishName.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      let safeRecipeUrl = recipeUrl.trim() || null
      if (safeRecipeUrl) {
        try {
          const parsed = new URL(safeRecipeUrl)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            safeRecipeUrl = null
          }
        } catch {
          // Not a valid URL, keep as-is (could be partial like "grandma's cookbook")
        }
      }

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
        isCombo,
        recipeUrl: safeRecipeUrl,
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        cuisineType: cuisineType.trim(),
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
        onFileSelect={(file) => {
          setPhotoFile(file)
          if (onPhotoSelected) onPhotoSelected(file)
        }}
        onClear={() => {
          setPhotoFile(null)
          if (onPhotoClear) onPhotoClear()
        }}
      />
      {(analysis?.status === 'uploading' || analysis?.status === 'analyzing') && (
        <p className="text-xs text-stone-400 mt-1">Analyzing photo...</p>
      )}
      {analysis?.error === 'resize_failed' && (
        <p className="text-xs text-red-500 mt-1">
          Could not process this photo. Try a different image.
        </p>
      )}
      {analysis?.error === 'file_too_large' && (
        <p className="text-xs text-red-500 mt-1">
          This photo is too large. Try a smaller image (under 20MB).
        </p>
      )}
      {analysis?.status === 'error' && analysis?.error && analysis.error !== 'resize_failed' && analysis.error !== 'file_too_large' && (
        <p className="text-xs text-red-500 mt-1">
          Could not analyze this photo. You can still fill in the details manually.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          What did you eat? *
          {aiVisible.has('dish_name') && (
            <span className="text-xs text-amber-600 ml-1">AI</span>
          )}
        </label>
        <input
          type="text"
          value={dishName}
          onChange={(e) => {
            setDishName(e.target.value)
            clearAiBadge('dish_name')
          }}
          placeholder="e.g. Chicken biryani"
          required
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Cuisine type
          {aiVisible.has('cuisine_type') && (
            <span className="text-xs text-amber-600 ml-1">AI</span>
          )}
        </label>
        <input
          type="text"
          value={cuisineType}
          onChange={(e) => {
            setCuisineType(e.target.value)
            clearAiBadge('cuisine_type')
          }}
          placeholder="e.g. North Indian, Italian, Chinese"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Meal type
          {aiVisible.has('entry_type') && (
            <span className="text-xs text-amber-600 ml-1">AI</span>
          )}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEntryType('eating_out')
              userTouchedEntryType.current = true
              clearAiBadge('entry_type')
            }}
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
            onClick={() => {
              setEntryType('home_cooked')
              userTouchedEntryType.current = true
              clearAiBadge('entry_type')
            }}
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
          placeholder={notesPlaceholder}
          rows={3}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white resize-none"
        />
      </div>

      {entryType === 'home_cooked' && (
        <>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Recipe URL
            </label>
            <input
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="e.g. https://..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Prep time (minutes)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder="e.g. 30"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            />
          </div>
        </>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          {showMore ? '− Fewer options' : '+ More options'}
        </button>
        {showMore && (
          <label className="flex items-start gap-2 mt-2">
            <input
              type="checkbox"
              checked={isCombo}
              onChange={(e) => setIsCombo(e.target.checked)}
              className="mt-1 accent-stone-900"
            />
            <span>
              <span className="text-sm font-medium text-stone-700">
                This is a combo meal
              </span>
              <span className="block text-xs text-stone-400">
                Includes both restaurant and homemade elements
              </span>
            </span>
          </label>
        )}
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
