import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getEntry, deleteEntry } from '../lib/entries'
import PageShell from '../components/PageShell'
import ConfirmDialog from '../components/ConfirmDialog'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function Entry() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    setDeleting(true)
    const { error } = await deleteEntry(id)
    if (error) {
      setError(error.message)
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }
    navigate('/')
  }

  if (loading) {
    return (
      <PageShell backTo="/">
        <p className="text-stone-400 text-center py-8">Loading...</p>
      </PageShell>
    )
  }

  if (error || !entry) {
    return (
      <PageShell backTo="/">
        <p className="text-red-500 text-center py-8">
          {error || 'Entry not found'}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell backTo="/">
      {entry.photo_url ? (
        <img
          src={entry.photo_url}
          alt={entry.dish_name}
          className="w-full h-64 object-cover rounded-lg mb-4 -mt-2"
        />
      ) : (
        <div className="w-full h-40 bg-stone-100 rounded-lg flex items-center justify-center mb-4 -mt-2">
          <span className="text-stone-300 text-5xl">&#127858;</span>
        </div>
      )}

      <h1 className="text-2xl font-bold text-stone-900 mb-2">
        {entry.dish_name}
      </h1>

      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mb-4 ${
        entry.entry_type === 'home_cooked'
          ? 'bg-green-100 text-green-700'
          : 'bg-blue-100 text-blue-700'
      }`}>
        {entry.entry_type === 'home_cooked' ? 'Home cooked' : 'Eating out'}
      </span>

      <div className="space-y-3 mb-8">
        {entry.venue_name && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Where</p>
            <p className="text-stone-700">{entry.venue_name}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wide">When</p>
          <p className="text-stone-700">
            {formatDate(entry.ate_at)} at {formatTime(entry.ate_at)}
          </p>
        </div>

        {entry.rating && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Rating</p>
            <p className="text-amber-400 text-lg">
              {'★'.repeat(entry.rating)}
              {'☆'.repeat(5 - entry.rating)}
            </p>
          </div>
        )}

        {entry.cost != null && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Cost</p>
            <p className="text-stone-700">${Number(entry.cost).toFixed(2)}</p>
          </div>
        )}

        {entry.companions && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">With</p>
            <p className="text-stone-700">{entry.companions}</p>
          </div>
        )}

        {entry.notes && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Notes</p>
            <p className="text-stone-600 italic">{entry.notes}</p>
          </div>
        )}
      </div>

      <Link
        to={`/edit/${entry.id}`}
        className="block w-full py-3 bg-stone-900 text-white rounded-lg font-medium text-center hover:bg-stone-800 transition-colors mb-3"
      >
        Edit entry
      </Link>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full py-3 text-red-500 font-medium hover:text-red-600 transition-colors cursor-pointer"
      >
        Delete entry
      </button>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this entry?"
        message="This can't be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </PageShell>
  )
}

export default Entry
