function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? null : star)}
          className="text-2xl cursor-pointer hover:scale-110 transition-transform"
        >
          {star <= (value || 0) ? (
            <span className="text-amber-400">&#9733;</span>
          ) : (
            <span className="text-stone-300">&#9733;</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default StarRating
