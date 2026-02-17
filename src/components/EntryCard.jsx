import { Link } from 'react-router-dom'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

function EntryCard({ entry }) {
  const entryTypeLabel =
    entry.entry_type === 'home_cooked'
      ? '🏠'
      : entry.entry_type === 'eating_out'
        ? '🍽️'
        : null

  return (
    <Link
      to={`/entry/${entry.id}`}
      className="flex gap-3 p-3 bg-white border border-stone-200 rounded-lg hover:border-stone-300 transition-colors"
    >
      {entry.photo_url ? (
        <img
          src={entry.photo_url}
          alt={entry.dish_name}
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
          <span className="text-stone-300 text-2xl">&#127858;</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900 truncate">{entry.dish_name}</p>
        {entry.venue_name && (
          <p className="text-sm text-stone-500 truncate">{entry.venue_name}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-stone-400">
            {formatDate(entry.ate_at)} &middot; {formatTime(entry.ate_at)}
          </p>
          {entry.rating && (
            <span className="text-xs text-amber-400">
              {'★'.repeat(entry.rating)}
            </span>
          )}
          {entryTypeLabel && (
            <span className="text-xs text-stone-400">{entryTypeLabel}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default EntryCard
