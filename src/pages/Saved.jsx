import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const REDIRECT_DELAY = 4000

function Saved() {
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = location.state?.returnTo || '/'

  useEffect(() => {
    const timer = setTimeout(() => navigate(returnTo, { replace: true }), REDIRECT_DELAY)
    return () => clearTimeout(timer)
  }, [navigate, returnTo])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4 text-green-600">✓</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Meal saved!</h1>
        <button
          onClick={() => navigate(returnTo, { replace: true })}
          className="mt-8 text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

export default Saved
