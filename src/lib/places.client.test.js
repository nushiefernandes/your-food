import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBucket, mockSupabase } = vi.hoisted(() => ({
  mockBucket: {
    select: vi.fn(),
    order: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
  },
  mockSupabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('./supabase', () => ({
  supabase: mockSupabase,
}))

import {
  autocompletePlace,
  getPlaceDetails,
  getSavedPlaces,
  savePlace,
  searchNearby,
} from './places'

function resetBucketMocks() {
  mockBucket.select.mockImplementation(() => mockBucket)
  mockBucket.order.mockResolvedValue({ data: [], error: null })
  mockBucket.upsert.mockImplementation(() => mockBucket)
  mockBucket.single.mockResolvedValue({ data: null, error: null })
}

describe('places client lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetBucketMocks()
    mockSupabase.from.mockReturnValue(mockBucket)
  })

  it('searchNearby returns parsed places from Edge Function', async () => {
    const places = [{ google_place_id: 'g-1', name: 'Mabrouk' }]
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { places },
      error: null,
    })

    const result = await searchNearby(12.97, 77.59, 120)

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'places',
      expect.objectContaining({
        body: { type: 'nearby', lat: 12.97, lng: 77.59, radius: 120 },
      })
    )
    expect(result).toEqual(places)
  })

  it('autocompletePlace returns predictions list', async () => {
    const predictions = [{ google_place_id: 'g-2', name: 'Toit', secondary: 'Bengaluru' }]
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { predictions },
      error: null,
    })

    const result = await autocompletePlace('toi', 12.97, 77.59)

    expect(result).toEqual(predictions)
  })

  it('getPlaceDetails returns normalized place payload', async () => {
    const place = { google_place_id: 'g-3', name: 'Truffles' }
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { place },
      error: null,
    })

    const result = await getPlaceDetails('g-3')

    expect(result).toEqual(place)
  })

  it('searchNearby returns empty list on timeout abort', async () => {
    mockSupabase.functions.invoke.mockRejectedValue({ name: 'AbortError' })

    const result = await searchNearby(12.97, 77.59)

    expect(result).toEqual([])
  })

  it('getSavedPlaces returns descending created_at list', async () => {
    const rows = [{ id: 'p-1' }, { id: 'p-2' }]

    mockBucket.order.mockResolvedValue({ data: rows, error: null })

    const result = await getSavedPlaces()

    expect(mockSupabase.from).toHaveBeenCalledWith('places')
    expect(mockBucket.select).toHaveBeenCalledWith('*')
    expect(mockBucket.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })

  it('savePlace upserts place with authenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-9' } } })
    mockBucket.single.mockResolvedValue({
      data: { id: 'place-1', google_place_id: 'g-7', user_id: 'user-9' },
      error: null,
    })

    const result = await savePlace({
      google_place_id: 'g-7',
      name: 'Cafe Coffee Day',
      lat: 12.1,
      lng: 77.2,
      address: { formatted: 'Bengaluru' },
    })

    expect(mockBucket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        google_place_id: 'g-7',
        user_id: 'user-9',
      }),
      { onConflict: 'user_id,google_place_id' }
    )
    expect(result).toEqual({ id: 'place-1', google_place_id: 'g-7', user_id: 'user-9' })
  })

  it('savePlace returns null when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await savePlace({ google_place_id: 'g-8', name: 'No Auth Place' })

    expect(result).toBeNull()
    expect(mockBucket.upsert).not.toHaveBeenCalled()
  })
})
