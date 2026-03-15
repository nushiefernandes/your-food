// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (supabase + geo) ──────────────────────────────────────────
const mockInvoke     = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())
const mockFrom       = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    auth:      { getSession: mockGetSession },
    from:      mockFrom,
  },
}))

import { findNearbyPlace, savePlace, getSavedPlaces, searchNearby } from './places'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER  = { id: 'user-123' }
const PLACE = {
  id: 'place-uuid',
  google_place_id: 'ChIJtest',
  name: 'Chinitas',
  lat: 12.9716,
  lng: 77.5946,
}

const savedPlaces = [
  { id: '1', name: 'Cafe Coffee Day', lat: 12.9716, lng: 77.5946 },
  { id: '2', name: 'Mabrouk',         lat: 12.9580, lng: 77.5920 },
  { id: '3', name: 'Toit',            lat: 12.9784, lng: 77.6408 },
]

// Makes a chainable Supabase query mock (select/order/upsert/single).
function makeFromChain(resolvedWith = { data: null, error: null }) {
  const chain = {
    select: vi.fn(),
    order:  vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.order.mockResolvedValue(resolvedWith)
  chain.single.mockResolvedValue(resolvedWith)
  return chain
}

beforeEach(() => vi.clearAllMocks())

// ─── findNearbyPlace (uses real haversineMeters — stronger than mocked) ───────
describe('findNearbyPlace', () => {

  // Catches M1 (<=→>=): 0m distance fails >= 50 check → no match returned.
  it('returns exact match at 0m distance', () => {
    const match = findNearbyPlace(12.9716, 77.5946, savedPlaces, 50)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Cafe Coffee Day')
  })

  it('returns place within 50m radius', () => {
    // ~30m offset from Cafe Coffee Day
    const match = findNearbyPlace(12.9718, 77.5946, savedPlaces, 50)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Cafe Coffee Day')
  })

  // Catches M1 (<=→>=): with the bug, far place wrongly passes >= check.
  it('returns null when no place is within the radius', () => {
    const match = findNearbyPlace(12.9800, 77.5946, savedPlaces, 50)
    expect(match).toBeNull()
  })

  it('returns null for an empty places array', () => {
    expect(findNearbyPlace(12.9716, 77.5946, [], 50)).toBeNull()
  })

  it('returns the first match when multiple places are nearby', () => {
    const closePlaces = [
      { id: '1', name: 'Place A', lat: 12.9716, lng: 77.5946 },
      { id: '2', name: 'Place B', lat: 12.9716, lng: 77.5947 },
    ]
    expect(findNearbyPlace(12.9716, 77.5946, closePlaces, 50).name).toBe('Place A')
  })

  it('respects a custom radius', () => {
    expect(findNearbyPlace(12.9716, 77.5946, savedPlaces, 50)?.name).toBe('Cafe Coffee Day')
    // 5km radius — CCD still returned first
    expect(findNearbyPlace(12.9716, 77.5946, savedPlaces, 5000)?.name).toBe('Cafe Coffee Day')
  })

  it('skips places whose lat or lng is not a number', () => {
    const stringCoords = [{ id: '1', name: 'X', lat: '12.9716', lng: 77.5946 }]
    expect(findNearbyPlace(12.9716, 77.5946, stringCoords, 50)).toBeNull()
  })

})

// ─── savePlace ────────────────────────────────────────────────────────────────
describe('savePlace', () => {

  // Catches M2: onConflict: 'google_place_id' → could overwrite another user's record.
  // Deleting this assertion means M2 goes undetected.
  it('uses (user_id, google_place_id) as the conflict target', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: USER } } })
    const chain = makeFromChain({ data: PLACE, error: null })
    mockFrom.mockReturnValue(chain)

    await savePlace({ google_place_id: 'ChIJtest', name: 'Chinitas' })

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ onConflict: 'user_id,google_place_id' })
    )
  })

  // Catches M3: user_id omitted → RLS rejects the insert, returns null silently.
  // Deleting this assertion means M3 goes undetected.
  it('includes user_id in the upsert payload', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: USER } } })
    const chain = makeFromChain({ data: PLACE, error: null })
    mockFrom.mockReturnValue(chain)

    await savePlace({ google_place_id: 'ChIJtest', name: 'Chinitas' })

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER.id }),
      expect.any(Object)
    )
  })

  it('returns null without hitting the DB when user is not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    expect(await savePlace({ google_place_id: 'ChIJtest' })).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

})

// ─── getSavedPlaces ───────────────────────────────────────────────────────────
describe('getSavedPlaces', () => {

  // Catches M4: return data (not data ?? []) → caller gets null, crashes on iteration.
  // Deleting this assertion means M4 goes undetected.
  it('returns an empty array when the query returns null data', async () => {
    const chain = makeFromChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)
    expect(await getSavedPlaces()).toEqual([])
  })

  // Catches M5: .select('id') omits lat/lng → findNearbyPlace skips every row.
  // Deleting this assertion means M5 goes undetected.
  it('returns places that include lat and lng fields', async () => {
    const chain = makeFromChain({ data: [PLACE], error: null })
    mockFrom.mockReturnValue(chain)
    const result = await getSavedPlaces()
    expect(result[0]).toHaveProperty('lat')
    expect(result[0]).toHaveProperty('lng')
  })

})

// ─── invokePlaces (via searchNearby) ─────────────────────────────────────────
describe('invokePlaces — signal and timeout', () => {

  // Catches M6: signal not passed → request can't be aborted on timeout, hangs forever.
  // Deleting this assertion means M6 goes undetected.
  it('passes an AbortSignal to supabase.functions.invoke', async () => {
    mockInvoke.mockResolvedValue({ data: { places: [] }, error: null })
    await searchNearby(12.9, 77.6)
    expect(mockInvoke).toHaveBeenCalledWith(
      'places',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  // Catches M7 (error path): AbortError → returns [] not an unhandled rejection.
  it('returns empty array when invoke throws an AbortError', async () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    mockInvoke.mockRejectedValue(err)
    expect(await searchNearby(12.9, 77.6)).toEqual([])
  })

  // Catches M7 (timer path): abort controller fires after TIMEOUT_MS.
  it('aborts the controller when invoke hangs past the timeout', async () => {
    vi.useFakeTimers()
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    mockInvoke.mockReturnValue(new Promise(() => {})) // never resolves

    searchNearby(12.9, 77.6) // intentionally not awaited

    expect(abortSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10001)
    expect(abortSpy).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
    abortSpy.mockRestore()
  })

  it('returns empty array on a data-level error from the Edge Function', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'quota_exceeded' }, error: null })
    expect(await searchNearby(12.9, 77.6)).toEqual([])
  })

})
