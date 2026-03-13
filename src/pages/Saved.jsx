import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getInsights } from '../lib/insights'
import { selectNudge } from '../lib/nudges'

const REDIRECT_DELAY = 4000

function Saved() {
  const location = useLocation()
  const navigate = useNavigate()
  const entry = location.state?.entry || null
  const returnTo = location.state?.returnTo || '/'

  const [nudge, setNudge] = useState(null)
  const [insightsReady, setInsightsReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => navigate(returnTo, { replace: true }), REDIRECT_DELAY)
    return () => clearTimeout(timer)
  }, [navigate, returnTo])

  useEffect(() => {
    async function load() {
      const { data, error } = await getInsights()
      if (error || !data) { setInsightsReady(true); return }

      // sessionStorage may be unavailable in some private browsing modes — guard it
      let lastNudgeId = null
      try { lastNudgeId = sessionStorage.getItem('last_nudge_id') } catch {}
      const picked = selectNudge(entry, data.insights, lastNudgeId)
      if (picked) {
        try { sessionStorage.setItem('last_nudge_id', picked.id) } catch {}
        setNudge(picked.text)
      }
      setInsightsReady(true)
    }
    load()
  }, [entry])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4 text-green-600">✓</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Meal saved!</h1>

        {insightsReady && nudge && (
          <p className="mt-6 text-stone-500 text-sm leading-relaxed">{nudge}</p>
        )}

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
