import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchEntries } from '../lib/entries'

function parseFilters(searchParams) {
  return {
    q: searchParams.get('q') || '',
    entryType: searchParams.get('entryType') || '',
    minRating: searchParams.get('minRating')
      ? parseInt(searchParams.get('minRating'), 10)
      : null,
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    cuisine: searchParams.get('cuisine') || '',
    venue: searchParams.get('venue') || '',
    sortBy: searchParams.get('sortBy') || 'ate_at',
    sortAsc: searchParams.get('sortAsc') === 'true',
  }
}

export function useFilteredEntries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const qDebounceRef = useRef(null)
  const latestSearchParamsRef = useRef(searchParams)

  useEffect(() => {
    latestSearchParamsRef.current = searchParams
  }, [searchParams])

  useEffect(() => {
    return () => {
      clearTimeout(qDebounceRef.current)
    }
  }, [])

  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  useEffect(() => {
    let active = true

    async function fetchEntries() {
      setLoading(true)
      setError(null)

      const { data, error } = await searchEntries(filters)

      if (!active) return

      if (error) {
        setError(error.message)
        setEntries([])
      } else {
        setEntries(data || [])
      }

      setLoading(false)
    }

    fetchEntries()

    return () => {
      active = false
    }
  }, [filters])

  const setFilter = useCallback((key, value) => {
    const applyFilter = () => {
      const nextParams = new URLSearchParams(latestSearchParamsRef.current)

      if (!value) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, String(value))
      }

      setSearchParams(nextParams)
    }

    if (key === 'q') {
      clearTimeout(qDebounceRef.current)
      qDebounceRef.current = setTimeout(applyFilter, 300)
      return
    }

    applyFilter()
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    clearTimeout(qDebounceRef.current)
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  return {
    entries,
    loading,
    error,
    filters,
    setFilter,
    clearFilters,
    resultCount: entries.length,
  }
}
