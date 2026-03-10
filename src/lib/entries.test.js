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
    in: vi.fn(),
    or: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    ilike: vi.fn(),
    not: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  builder.select.mockImplementation(() => builder)
  builder.eq.mockImplementation(() => builder)
  builder.in.mockImplementation(() => builder)
  builder.or.mockImplementation(() => builder)
  builder.gte.mockImplementation(() => builder)
  builder.lte.mockImplementation(() => builder)
  builder.ilike.mockImplementation(() => builder)
  builder.not.mockImplementation(() => builder)
  builder.limit.mockImplementation(() => builder)
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
    const entriesBuilder = makeEntriesBuilder()
    const photosBuilder = makeEntriesBuilder()
    const row = { id: 'entry-42', dish_name: 'Ramen' }

    entriesBuilder.single.mockResolvedValue({ data: row, error: null })
    photosBuilder.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'entries') return entriesBuilder
      if (table === 'entry_photos') return photosBuilder
      return makeEntriesBuilder()
    })

    const result = await getEntry('entry-42')

    expect(entriesBuilder.select).toHaveBeenCalledWith('*')
    expect(entriesBuilder.eq).toHaveBeenCalledWith('id', 'entry-42')
    expect(entriesBuilder.single).toHaveBeenCalledTimes(1)
    expect(photosBuilder.select).toHaveBeenCalledWith('*')
    expect(photosBuilder.eq).toHaveBeenCalledWith('entry_id', 'entry-42')
    expect(photosBuilder.order).toHaveBeenCalledWith('sort_order')
    expect(result).toEqual({ data: { ...row, photos: [] }, error: null })
  })

  it('getEntry returns entry with photos from entry_photos table', async () => {
    const entriesBuilder = makeEntriesBuilder()
    const photosBuilder = makeEntriesBuilder()
    const row = { id: 'entry-42', dish_name: 'Ramen' }
    const photos = [
      { id: 'photo-1', entry_id: 'entry-42', sort_order: 0 },
      { id: 'photo-2', entry_id: 'entry-42', sort_order: 1 },
    ]

    entriesBuilder.single.mockResolvedValue({ data: row, error: null })
    photosBuilder.order.mockResolvedValue({ data: photos, error: null })
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'entries') return entriesBuilder
      if (table === 'entry_photos') return photosBuilder
      return makeEntriesBuilder()
    })

    const result = await getEntry('entry-42')

    expect(result).toEqual({
      data: { ...row, photos },
      error: null,
    })
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

  it('createEntry with one photo inserts entry_photos with is_primary true', async () => {
    const entriesBuilder = makeEntriesBuilder()
    const photosBuilder = makeEntriesBuilder()

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    entriesBuilder.single.mockResolvedValue({
      data: { id: 'entry-1', dish_name: 'Pho', user_id: 'user-123' },
      error: null,
    })
    photosBuilder.insert.mockResolvedValue({ error: null })
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'entries') return entriesBuilder
      if (table === 'entry_photos') return photosBuilder
      return makeEntriesBuilder()
    })

    await createEntry(
      { dish_name: 'Pho' },
      [{
        url: 'https://cdn.example/p1.jpg',
        path: 'user-123/p1.jpg',
        gps_lat: 12.9,
        gps_lng: 77.5,
        taken_at: '2026-03-10T10:00:00Z',
      }]
    )

    expect(photosBuilder.insert).toHaveBeenCalledWith([{
      entry_id: 'entry-1',
      url: 'https://cdn.example/p1.jpg',
      path: 'user-123/p1.jpg',
      gps_lat: 12.9,
      gps_lng: 77.5,
      taken_at: '2026-03-10T10:00:00Z',
      is_primary: true,
      sort_order: 0,
    }])
  })

  it('createEntry with multiple photos sets is_primary false for index 1', async () => {
    const entriesBuilder = makeEntriesBuilder()
    const photosBuilder = makeEntriesBuilder()

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    entriesBuilder.single.mockResolvedValue({
      data: { id: 'entry-1', dish_name: 'Pho', user_id: 'user-123' },
      error: null,
    })
    photosBuilder.insert.mockResolvedValue({ error: null })
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'entries') return entriesBuilder
      if (table === 'entry_photos') return photosBuilder
      return makeEntriesBuilder()
    })

    await createEntry(
      { dish_name: 'Pho' },
      [
        { url: 'https://cdn.example/p1.jpg', path: 'user-123/p1.jpg' },
        { url: 'https://cdn.example/p2.jpg', path: 'user-123/p2.jpg' },
      ]
    )

    const insertedRows = photosBuilder.insert.mock.calls[0][0]
    expect(insertedRows[1]).toMatchObject({
      entry_id: 'entry-1',
      url: 'https://cdn.example/p2.jpg',
      path: 'user-123/p2.jpg',
      is_primary: false,
      sort_order: 1,
    })
  })

  it('createEntry without photos does not insert into entry_photos', async () => {
    const entriesBuilder = makeEntriesBuilder()
    const photosBuilder = makeEntriesBuilder()

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    entriesBuilder.single.mockResolvedValue({
      data: { id: 'entry-1', dish_name: 'Pho', user_id: 'user-123' },
      error: null,
    })
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'entries') return entriesBuilder
      if (table === 'entry_photos') return photosBuilder
      return makeEntriesBuilder()
    })

    await createEntry({ dish_name: 'Pho' })

    expect(photosBuilder.insert).not.toHaveBeenCalled()
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

  it('updateEntry deletes removed photo IDs and inserts added photos', async () => {
    const updateBuilder = makeEntriesBuilder()
    const deletePhotosBuilder = makeEntriesBuilder()
    const maxSortBuilder = makeEntriesBuilder()
    const insertPhotosBuilder = makeEntriesBuilder()

    updateBuilder.single.mockResolvedValue({
      data: { id: 'entry-1', notes: 'Updated' },
      error: null,
    })
    deletePhotosBuilder.in.mockResolvedValue({ error: null })
    maxSortBuilder.order.mockImplementation(() => maxSortBuilder)
    maxSortBuilder.limit.mockResolvedValue({ data: [{ sort_order: 2 }], error: null })
    insertPhotosBuilder.insert.mockResolvedValue({ error: null })

    mockSupabase.from
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(deletePhotosBuilder)
      .mockReturnValueOnce(maxSortBuilder)
      .mockReturnValueOnce(insertPhotosBuilder)

    const result = await updateEntry(
      'entry-1',
      { notes: 'Updated' },
      [{ url: 'https://cdn.example/p3.jpg', path: 'user-1/p3.jpg' }],
      ['remove-id-1']
    )

    expect(deletePhotosBuilder.delete).toHaveBeenCalledTimes(1)
    expect(deletePhotosBuilder.in).toHaveBeenCalledWith('id', ['remove-id-1'])
    expect(maxSortBuilder.select).toHaveBeenCalledWith('sort_order')
    expect(maxSortBuilder.eq).toHaveBeenCalledWith('entry_id', 'entry-1')
    expect(maxSortBuilder.order).toHaveBeenCalledWith('sort_order', { ascending: false })
    expect(maxSortBuilder.limit).toHaveBeenCalledWith(1)
    expect(insertPhotosBuilder.insert).toHaveBeenCalledWith([{
      entry_id: 'entry-1',
      url: 'https://cdn.example/p3.jpg',
      path: 'user-1/p3.jpg',
      gps_lat: null,
      gps_lng: null,
      taken_at: null,
      is_primary: false,
      sort_order: 3,
    }])
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
