import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
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
  createEntry,
  deleteEntry,
  getDistinctCuisines,
  getEntries,
  getEntry,
  searchEntries,
  updateEntry,
} from './entries'

function makeEntriesBuilder() {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    ilike: vi.fn(),
    not: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  builder.select.mockImplementation(() => builder)
  builder.eq.mockImplementation(() => builder)
  builder.or.mockImplementation(() => builder)
  builder.gte.mockImplementation(() => builder)
  builder.lte.mockImplementation(() => builder)
  builder.ilike.mockImplementation(() => builder)
  builder.not.mockImplementation(() => builder)
  builder.insert.mockImplementation(() => builder)
  builder.update.mockImplementation(() => builder)
  builder.delete.mockImplementation(() => builder)

  return builder
}

describe('entries lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getEntries selects all rows ordered by ate_at desc', async () => {
    const builder = makeEntriesBuilder()
    const rows = [{ id: 'entry-1' }]

    builder.order.mockResolvedValue({ data: rows, error: null })
    mockSupabase.from.mockReturnValue(builder)

    const result = await getEntries()

    expect(mockSupabase.from).toHaveBeenCalledWith('entries')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('ate_at', { ascending: false })
    expect(result).toEqual({ data: rows, error: null })
  })

  it('getEntry fetches one row by id', async () => {
    const builder = makeEntriesBuilder()
    const row = { id: 'entry-42', dish_name: 'Ramen' }

    builder.single.mockResolvedValue({ data: row, error: null })
    mockSupabase.from.mockReturnValue(builder)

    const result = await getEntry('entry-42')

    expect(mockSupabase.from).toHaveBeenCalledWith('entries')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('id', 'entry-42')
    expect(builder.single).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: row, error: null })
  })

  it('createEntry adds authenticated user_id before insert', async () => {
    const builder = makeEntriesBuilder()

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    builder.single.mockResolvedValue({
      data: { id: 'entry-99', dish_name: 'Pho', user_id: 'user-123' },
      error: null,
    })
    mockSupabase.from.mockReturnValue(builder)

    const result = await createEntry({ dish_name: 'Pho' })

    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1)
    expect(builder.insert).toHaveBeenCalledWith({ dish_name: 'Pho', user_id: 'user-123' })
    expect(builder.select).toHaveBeenCalledTimes(1)
    expect(builder.single).toHaveBeenCalledTimes(1)
    expect(result.data.user_id).toBe('user-123')
  })

  it('updateEntry updates one row by id and returns single row', async () => {
    const builder = makeEntriesBuilder()

    builder.single.mockResolvedValue({
      data: { id: 'entry-1', notes: 'Updated' },
      error: null,
    })
    mockSupabase.from.mockReturnValue(builder)

    const result = await updateEntry('entry-1', { notes: 'Updated' })

    expect(builder.update).toHaveBeenCalledWith({ notes: 'Updated' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'entry-1')
    expect(builder.select).toHaveBeenCalledTimes(1)
    expect(builder.single).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: { id: 'entry-1', notes: 'Updated' }, error: null })
  })

  it('deleteEntry deletes by id', async () => {
    const builder = makeEntriesBuilder()

    builder.eq.mockResolvedValue({ error: null })
    mockSupabase.from.mockReturnValue(builder)

    const result = await deleteEntry('entry-del')

    expect(builder.delete).toHaveBeenCalledTimes(1)
    expect(builder.eq).toHaveBeenCalledWith('id', 'entry-del')
    expect(result).toEqual({ error: null })
  })

  it('searchEntries with text query builds correct or() filter', async () => {
    const builder = makeEntriesBuilder()
    const rows = [{ id: 'entry-1' }]

    builder.order.mockResolvedValue({ data: rows, error: null })
    mockSupabase.from.mockReturnValue(builder)

    const result = await searchEntries({ q: 'ramen' })

    expect(builder.or).toHaveBeenCalledWith(
      'dish_name.ilike.%ramen%,venue_name.ilike.%ramen%,notes.ilike.%ramen%,cuisine_type.ilike.%ramen%,neighbourhood.ilike.%ramen%'
    )
    expect(builder.order).toHaveBeenCalledWith('ate_at', { ascending: false })
    expect(result).toEqual({ data: rows, error: null })
  })

  it('searchEntries with entryType filter calls .eq()', async () => {
    const builder = makeEntriesBuilder()

    builder.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder)

    await searchEntries({ entryType: 'home_cooked' })

    expect(builder.eq).toHaveBeenCalledWith('entry_type', 'home_cooked')
  })

  it('searchEntries with minRating calls .gte()', async () => {
    const builder = makeEntriesBuilder()

    builder.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder)

    await searchEntries({ minRating: 4 })

    expect(builder.gte).toHaveBeenCalledWith('rating', 4)
  })

  it('searchEntries with date range calls .gte() and .lte()', async () => {
    const builder = makeEntriesBuilder()

    builder.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder)

    await searchEntries({ dateFrom: '2026-03-01', dateTo: '2026-03-07' })

    expect(builder.gte).toHaveBeenCalledWith('ate_at', '2026-03-01')
    expect(builder.lte).toHaveBeenCalledWith('ate_at', '2026-03-07')
  })

  it('searchEntries with combined filters chains all methods', async () => {
    const builder = makeEntriesBuilder()

    builder.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder)

    await searchEntries({
      q: 'curry',
      entryType: 'eating_out',
      minRating: 3,
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cuisine: 'Indian',
      venue: 'Spice',
      sortBy: 'rating',
      sortAsc: true,
    })

    expect(builder.or).toHaveBeenCalledWith(
      'dish_name.ilike.%curry%,venue_name.ilike.%curry%,notes.ilike.%curry%,cuisine_type.ilike.%curry%,neighbourhood.ilike.%curry%'
    )
    expect(builder.eq).toHaveBeenCalledWith('entry_type', 'eating_out')
    expect(builder.gte).toHaveBeenNthCalledWith(1, 'rating', 3)
    expect(builder.gte).toHaveBeenNthCalledWith(2, 'ate_at', '2026-03-01')
    expect(builder.lte).toHaveBeenCalledWith('ate_at', '2026-03-07')
    expect(builder.ilike).toHaveBeenNthCalledWith(1, 'cuisine_type', '%Indian%')
    expect(builder.ilike).toHaveBeenNthCalledWith(2, 'venue_name', '%Spice%')
    expect(builder.order).toHaveBeenCalledWith('rating', { ascending: true })
  })

  it('searchEntries with no filters returns ordered results like getEntries', async () => {
    const builder = makeEntriesBuilder()
    const rows = [{ id: 'entry-2' }]

    builder.order.mockResolvedValue({ data: rows, error: null })
    mockSupabase.from.mockReturnValue(builder)

    const result = await searchEntries()

    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('ate_at', { ascending: false })
    expect(result).toEqual({ data: rows, error: null })
  })

  it('getDistinctCuisines returns unique sorted list', async () => {
    const builder = makeEntriesBuilder()

    builder.not.mockResolvedValue({
      data: [
        { cuisine_type: 'Thai' },
        { cuisine_type: 'Indian' },
        { cuisine_type: 'Thai' },
        { cuisine_type: 'Italian' },
        { cuisine_type: ' ' },
      ],
      error: null,
    })
    mockSupabase.from.mockReturnValue(builder)

    const result = await getDistinctCuisines()

    expect(builder.select).toHaveBeenCalledWith('cuisine_type')
    expect(builder.not).toHaveBeenCalledWith('cuisine_type', 'is', null)
    expect(result).toEqual(['Indian', 'Italian', 'Thai'])
  })
})
