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

import { createEntry, deleteEntry, getEntries, getEntry, updateEntry } from './entries'

function makeEntriesBuilder() {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  builder.select.mockImplementation(() => builder)
  builder.eq.mockImplementation(() => builder)
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
})
