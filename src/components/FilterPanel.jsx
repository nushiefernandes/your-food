import { useMemo, useState } from 'react'
import StarRating from './StarRating'

function FilterPanel({ filters, onFilterChange, onClear, cuisines }) {
  const [isOpen, setIsOpen] = useState(false)

  const activeFilterCount = useMemo(() => {
    return [
      filters.entryType,
      filters.minRating,
      filters.dateFrom,
      filters.dateTo,
      filters.cuisine,
      filters.venue,
      filters.sortBy && filters.sortBy !== 'ate_at' ? filters.sortBy : null,
    ].filter(Boolean).length
  }, [filters])

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        Filters
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-stone-700">Refine results</h2>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-stone-500 underline hover:text-stone-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Entry type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onFilterChange('entryType', filters.entryType === 'eating_out' ? '' : 'eating_out')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filters.entryType === 'eating_out'
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                Eating out
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('entryType', filters.entryType === 'home_cooked' ? '' : 'home_cooked')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filters.entryType === 'home_cooked'
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                Home cooked
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Minimum rating
            </label>
            <StarRating
              value={filters.minRating}
              onChange={(value) => onFilterChange('minRating', value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Date range</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-stone-500">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onFilterChange('dateFrom', e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-500">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onFilterChange('dateTo', e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Cuisine</label>
            <input
              type="text"
              list="cuisine-options"
              value={filters.cuisine}
              onChange={(e) => onFilterChange('cuisine', e.target.value)}
              placeholder="Type a cuisine"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <datalist id="cuisine-options">
              {cuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Sort by</label>
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="ate_at">Date</option>
              <option value="rating">Rating</option>
              <option value="cost">Cost</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPanel
