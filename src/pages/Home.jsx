import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Home() {
  const [testMessage, setTestMessage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchTest() {
      const { data, error } = await supabase.from('test').select('*').limit(1)
      if (error) {
        setError(error.message)
      } else if (data && data.length > 0) {
        setTestMessage(data[0].message)
      }
      setLoading(false)
    }
    fetchTest()
  }, [])

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-12">
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

        <div className="mt-12 p-4 rounded-lg bg-white border border-stone-200">
          <p className="text-sm font-medium text-stone-400 mb-1">Supabase connection</p>
          {loading && <p className="text-stone-500">Connecting...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {testMessage && (
            <p className="text-green-600 font-medium">{testMessage}</p>
          )}
          {!loading && !error && !testMessage && (
            <p className="text-amber-500">
              No test table found. Create it in Supabase to verify the connection.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
