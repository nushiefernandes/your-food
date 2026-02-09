import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEntries } from '../lib/entries'
import { useAuth } from '../contexts/AuthContext'
import EntryCard from '../components/EntryCard'

function Home() {
  const { user, signOut } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

        <div className="mt-8 space-y-3">
          {loading && (
            <p className="text-stone-400 text-center py-8">Loading...</p>
          )}
          {error && (
            <p className="text-red-500 text-center py-8">{error}</p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-stone-400 text-center py-8">
              No meals logged yet. Tap above to add your first!
            </p>
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
