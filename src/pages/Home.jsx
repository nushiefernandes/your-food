import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getEntries } from '../lib/entries'
import { useAuth } from '../contexts/AuthContext'
import EntryCard from '../components/EntryCard'

const EMOJI_ROW = ['🍕', '🍜', '🌮', '🍛', '🍱']

const EMPTY_STATE_HEADLINES = [
  'Your food story starts with one bite',
  "Your stomach's diary is empty",
  'Every great food journey starts somewhere',
  "No meals yet — let's fix that",
  'Your taste buds have stories to tell',
  'First meal, best meal — log it!',
]

function getRandomItem(items) {
  if (!items?.length) return ''
  return items[Math.floor(Math.random() * items.length)]
}

function Home() {
  const { user, signOut } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showToast, setShowToast] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const emptyStateHeadline = useMemo(
    () => getRandomItem(EMPTY_STATE_HEADLINES),
    []
  )

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await getEntries()
      if (error) {
        setError(error.message)
      } else {
        setEntries(data || [])
      }
      setLoading(false)
    }
    fetchEntries()
  }, [])

  useEffect(() => {
    if (searchParams.get('saved')) {
      setShowToast(true)
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('saved')
      setSearchParams(newParams, { replace: true })
      const timer = setTimeout(() => setShowToast(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams])

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-12">
        {user && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-stone-400 truncate">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
        <h1 className="text-4xl font-bold text-stone-900 mb-2">Your Food</h1>
        <p className="text-stone-500 text-lg mb-8">
          A diary for everything you eat.
        </p>

        <Link
          to="/add"
          className="inline-block bg-stone-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-stone-800 transition-colors"
        >
          + Log a meal
        </Link>

        {showToast && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-2 rounded-lg text-center transition-opacity duration-500">
            Meal saved!
          </div>
        )}

        <div className="mt-8 space-y-3">
          {loading && (
            <p className="text-stone-400 text-center py-8">Loading...</p>
          )}
          {error && (
            <p className="text-red-500 text-center py-8">{error}</p>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-8">
              <div className="flex justify-center gap-3 text-3xl">
                {EMOJI_ROW.map((emoji) => (
                  <span key={emoji}>{emoji}</span>
                ))}
              </div>
              <p className="text-lg font-medium text-stone-600 mt-4">
                {emptyStateHeadline}
              </p>
              <Link
                to="/add"
                className="inline-block bg-stone-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-stone-800 transition-colors mt-4"
              >
                Log your first meal
              </Link>
            </div>
          )}
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home
