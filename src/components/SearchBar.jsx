import { useEffect, useState } from 'react'

function SearchBar({ value, onChange, onClear }) {
  const [localValue, setLocalValue] = useState(value || '')

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  function handleChange(e) {
    const nextValue = e.target.value
    setLocalValue(nextValue)
    onChange(nextValue)
  }

  function handleClear() {
    setLocalValue('')
    if (onClear) {
      onClear()
      return
    }
    onChange('')
  }

  return (
    <div className="relative w-full">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="Search dishes, places, notes..."
        aria-label="Search meals"
        className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-9 pr-9 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Clear search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default SearchBar
