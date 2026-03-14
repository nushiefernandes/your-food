// @vitest-environment jsdom
import { render, screen, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

afterEach(cleanup)

// ─── Hoisted mocks (must be defined before vi.mock factories run) ─────────────
const mockNavigate = vi.hoisted(() => vi.fn())
const mockInvoke   = vi.hoisted(() => vi.fn())
const mockSelectNudge = vi.hoisted(() => vi.fn())

// locationState is mutable — tests override it in beforeEach
let locationState = { entry: { id: 'eid-1', dish_name: 'Pasta' } }

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}))

vi.mock('../lib/nudges', () => ({
  selectNudge: mockSelectNudge,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams:   () => ({ entryId: 'eid-1' }),
    useLocation: () => ({ state: locationState }),
  }
})

import Saved from './Saved'

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Flush React's internal queue (microtasks) without advancing fake timers
const settle = () => act(async () => { await Promise.resolve() })

const SUCCESS_RESPONSE = {
  data: { insights: { meta: { total_meals: 5 } }, newMilestones: [] },
  error: null,
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Saved page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    locationState = { entry: { id: 'eid-1', dish_name: 'Pasta' } }
    mockInvoke.mockResolvedValue(SUCCESS_RESPONSE)
    mockSelectNudge.mockReturnValue(null)
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Catches M1: hasNavigated guard removed from leave() — both timers fire and
  // each calls navigate(), resulting in 2 navigation calls.
  // Deleting this assertion lets M1 survive: double-navigate goes undetected.
  it('navigates home exactly once even when both redirect timers fire', async () => {
    render(<Saved />)
    await settle()
    // status='ready' triggers min-display timer (1.5s)
    await act(async () => { vi.advanceTimersByTime(1500) })
    // hard cap also fires (4s from mount)
    await act(async () => { vi.advanceTimersByTime(2501) }) // total > 4000ms
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  // Catches M2: !location.state?.entry check removed from load effect —
  // without it, the component tries to invoke post-save with no entry and
  // never calls leave() early, so navigate is not called immediately.
  // Deleting this assertion: M2 survives, component hangs with no router state.
  it('redirects immediately when there is no router state entry', async () => {
    locationState = null
    render(<Saved />)
    await settle()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  // Catches M3: setStatus('error') removed from .catch() block —
  // without it, status stays 'loading' forever on network error, the loading
  // indicator never goes away, and the min-display timer never fires.
  // Deleting this assertion: M3 survives, error state goes undetected.
  it('removes loading indicator when post-save fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'))
    render(<Saved />)
    expect(screen.getByText('...')).not.toBeNull()
    await settle()
    expect(screen.queryByText('...')).toBeNull()
  })

  // Catches M4: controller.signal.aborted check removed — after unmount the
  // in-flight fetch resolves and tries to call setStatus/setNudge/setMilestones
  // on an unmounted component, triggering a React error or warning.
  // Deleting this assertion: M4 survives, stale state update goes undetected.
  it('does not call setters after unmount when fetch resolves late', async () => {
    let resolveInvoke
    mockInvoke.mockReturnValue(new Promise(resolve => { resolveInvoke = resolve }))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Saved />)
    unmount()
    // Resolve after unmount — should be no-op due to AbortController guard
    resolveInvoke(SUCCESS_RESPONSE)
    await settle()
    // No React "cannot update an unmounted component" error
    expect(errSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/unmounted|update.*state/i),
      expect.anything(),
    )
    errSpy.mockRestore()
  })

  // Catches M5: REDIRECT_DELAY timer fires at 0ms (instant) instead of 4000ms —
  // user never has a chance to see the page content.
  // Deleting this assertion: M5 survives, premature redirect goes undetected.
  it('does not redirect before 4 seconds have passed since mount', async () => {
    render(<Saved />)
    await act(async () => { vi.advanceTimersByTime(3999) })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // Catches M6: setStatus('ready') line removed — nudge/milestones are set
  // in state but status never becomes 'ready', so {status === 'ready' && nudge}
  // never renders the nudge text and the loading indicator remains.
  // Deleting this assertion: M6 survives, missing nudge text goes undetected.
  it('shows nudge text after a successful fetch', async () => {
    mockSelectNudge.mockReturnValue({ id: 'five_star', text: 'A 5-star meal!' })
    render(<Saved />)
    await settle()
    expect(screen.getByText('A 5-star meal!')).not.toBeNull()
  })

  // Catches M7: setMilestones(data.newMilestones) without ?? [] —
  // when newMilestones is absent from the response, milestones is set to
  // undefined and milestones.some() / milestones.map() crash at render.
  // Deleting this assertion: M7 survives, the crash is never reproduced.
  it('renders without crashing when newMilestones is absent from response', async () => {
    mockInvoke.mockResolvedValue({ data: { insights: {}, newMilestones: undefined }, error: null })
    expect(() => render(<Saved />)).not.toThrow()
    await settle()
    expect(screen.getByText('Meal saved!')).not.toBeNull()
  })

  // Catches M8: sessionStorage.setItem('last_nudge_id', ...) removed —
  // deduplication breaks: the same nudge fires again on the next save because
  // last_nudge_id is never written.
  // Deleting this assertion: M8 survives, nudge dedup silently stops working.
  it('persists the shown nudge id to sessionStorage for deduplication', async () => {
    mockSelectNudge.mockReturnValue({ id: 'five_star', text: 'A 5-star meal!' })
    render(<Saved />)
    await settle()
    expect(sessionStorage.getItem('last_nudge_id')).toBe('five_star')
  })

  // Catches M9: cleanup returns () => {} instead of () => controller.abort() —
  // when the component unmounts the fetch is not cancelled, and the resolved
  // value would attempt state updates if the aborted check were also removed.
  // Here we verify the timer is also cleaned up: no navigate after unmount.
  // Deleting this assertion: M9 survives, leaked timer calls navigate after unmount.
  it('does not navigate after unmount even when hard cap timer would have fired', async () => {
    const { unmount } = render(<Saved />)
    unmount()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // Bonus: milestone cards rendered when post-save returns newMilestones
  it('renders milestone card when a new milestone is returned', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        insights: {},
        newMilestones: [{ id: 'meals_10', label: '10 meals logged', emoji: '🍽️', confetti: false }],
      },
      error: null,
    })
    render(<Saved />)
    await settle()
    expect(screen.getByText(/10 meals logged/)).not.toBeNull()
  })
})
