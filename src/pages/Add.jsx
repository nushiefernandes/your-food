import { Link } from 'react-router-dom'

function Add() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-12">
        <Link
          to="/"
          className="text-stone-400 hover:text-stone-600 transition-colors text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 mt-4 mb-2">
          Log a meal
        </h1>
        <p className="text-stone-500">
          This is where you'll add food entries. Coming in Phase 1.
        </p>
      </div>
    </div>
  )
}

export default Add
