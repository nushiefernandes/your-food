import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getInsights } from '../lib/insights'
import { getEntry } from '../lib/entries'
import { selectNudge } from '../lib/nudges'
import { checkMilestones } from '../lib/milestones'
import { supabase } from '../lib/supabase'

const REDIRECT_DELAY = 4000
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

  // Happy path: entry already in state (just came from Add/Edit) — no DB fetch needed.
  // Refresh path: state is gone, fetch from DB using URL param.
  const [entry, setEntry] = useState(location.state?.entry || null)
  const [entryReady, setEntryReady] = useState(Boolean(location.state?.entry))

  const [nudge, setNudge] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [insightsReady, setInsightsReady] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => navigate(returnTo, { replace: true }), REDIRECT_DELAY)
    return () => clearTimeout(timer)
  }, [navigate, returnTo])

  // Fetch entry only when state didn't provide one (refresh case).
  useEffect(() => {
    if (entry) { setEntryReady(true); return }
    if (!entryId) { setEntryReady(true); return }

    let cancelled = false
    async function loadEntry() {
      const { data, error: entryError } = await getEntry(entryId)
      if (cancelled) return
      if (entryError || !data) {
        console.error('Saved: failed to fetch entry', entryId, entryError)
        navigate(returnTo, { replace: true })
        return
      }
      setEntry(data)
      setEntryReady(true)
    }
    loadEntry()
    return () => { cancelled = true }
  }, [entryId])

  // Run insights/nudge/milestones once entry is ready.
  useEffect(() => {
    if (!entryReady || loadedRef.current) return
    loadedRef.current = true

    async function load() {
      // Step 1: fetch insights
      const { data: insightsData, error: insightsError } = await getInsights()
      if (insightsError || !insightsData) {
        console.error('Saved: failed to fetch insights', insightsError)
        setInsightsReady(true)
        return
      }

      const insights = insightsData.insights

      // Step 2: nudge
      let lastNudgeId = null
      try { lastNudgeId = sessionStorage.getItem('last_nudge_id') } catch {}
      const picked = selectNudge(entry, insights, lastNudgeId)
      if (picked) {
        try { sessionStorage.setItem('last_nudge_id', picked.id) } catch {}
        setNudge(picked.text)
      }

      // Step 3: milestones
      const { data: seen, error: seenError } = await supabase
        .from('milestones_seen')
        .select('milestone')
      if (seenError) console.error('Saved: failed to fetch milestones_seen', seenError)

      const seenIds = (seen || []).map(r => r.milestone)
      const newMilestones = checkMilestones(insights, seenIds)

      if (newMilestones.length > 0) {
        const { error: insertError } = await supabase
          .from('milestones_seen')
          .upsert(
            newMilestones.map(m => ({ milestone: m.id })),
            { onConflict: 'user_id,milestone', ignoreDuplicates: true }
          )
        if (insertError) {
          console.error('Saved: failed to upsert milestones', insertError)
        } else {
          setMilestones(newMilestones)
          if (newMilestones.some(m => m.confetti)) setShowConfetti(true)
        }
      }

      setInsightsReady(true)
    }

    load()
  }, [entry, entryReady])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      {showConfetti && <ConfettiOverlay />}

      <div className="max-w-md w-full mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4 text-green-600">✓</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Meal saved!</h1>

        {milestones.map(m => (
          <div
            key={m.id}
            className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-3 rounded-lg"
          >
            {m.emoji} {m.label}
          </div>
        ))}

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
