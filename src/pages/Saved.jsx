import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { selectNudge } from '../lib/nudges'
import { supabase } from '../lib/supabase'

const REDIRECT_DELAY = 4000
const MIN_DISPLAY_DELAY = 1500
const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316']
const CONFETTI_COUNT = 24

const CONFETTI_PIECES = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  id: i,
  left: `${(i * 4.17) % 100}%`,
  delay: `${(i * 0.1) % 2}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}))

function ConfettiOverlay() {
  return (
    <div aria-hidden="true">
      {CONFETTI_PIECES.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: '-12px',
            animationDelay: p.delay,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

function Saved() {
  const { entryId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = location.state?.returnTo || '/'

  const [status, setStatus] = useState('loading')
  const [nudge, setNudge] = useState(null)
  const [milestones, setMilestones] = useState([])
  const showConfetti = milestones.some(m => m.confetti)
  const hasNavigated = useRef(false)

  function leave() {
    if (hasNavigated.current) return
    hasNavigated.current = true
    navigate(returnTo, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(leave, REDIRECT_DELAY)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (status !== 'ready' && status !== 'error') return
    const t = setTimeout(leave, MIN_DISPLAY_DELAY)
    return () => clearTimeout(t)
  }, [status])

  useEffect(() => {
    if (!location.state?.entry) {
      leave()
      return
    }

    const controller = new AbortController()
    const entryData = location.state.entry

    async function load() {
      const { data, error } = await supabase.functions.invoke('post-save', { body: { entryId } })
      if (controller.signal.aborted) return
      if (error || !data) {
        setStatus('error')
        return
      }

      const lastNudgeId = sessionStorage.getItem('last_nudge_id')
      const picked = selectNudge(entryData, data.insights, lastNudgeId)
      if (picked) sessionStorage.setItem('last_nudge_id', picked.id)

      setNudge(picked?.text ?? null)
      setMilestones(data.newMilestones ?? [])
      setStatus('ready')
    }

    load().catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })

    return () => controller.abort()
  }, [entryId])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      {showConfetti && <ConfettiOverlay />}

      <div className="max-w-md w-full mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4 text-green-600">✓</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Meal saved!</h1>

        {milestones.length > 0 &&
          milestones.map(m => (
            <div
              key={m.id}
              className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-3 rounded-lg"
            >
              {m.emoji} {m.label}
            </div>
          ))}

        {status === 'ready' && nudge && (
          <p className="mt-6 text-stone-500 text-sm leading-relaxed">{nudge}</p>
        )}

        {status === 'loading' && (
          <p className="mt-6 text-stone-400 text-sm animate-pulse">...</p>
        )}

        <button
          onClick={leave}
          className="mt-8 text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

export default Saved
