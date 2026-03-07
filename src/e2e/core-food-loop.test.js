import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, mockSupabase } = vi.hoisted(() => {
  const state = {
    entries: [],
    photos: new Set(),
    user: { id: 'user-e2e', email: 'e2e@example.com' },
  }

  function nextEntryId() {
    return `entry-${state.entries.length + 1}`
  }

  function makeEntriesQueryBuilder() {
    let operation = 'read'
    let insertPayload = null
    let updatePayload = null
    let filterField = null
    let filterValue = null

    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(async (field, opts) => {
        const sorted = [...state.entries].sort((a, b) => {
          if (a[field] === b[field]) return 0
          if (opts?.ascending) return a[field] > b[field] ? 1 : -1
          return a[field] > b[field] ? -1 : 1
        })
        return { data: sorted, error: null }
      }),
      eq: vi.fn((field, value) => {
        filterField = field
        filterValue = value

        if (operation === 'delete') {
          const before = state.entries.length
          state.entries = state.entries.filter((row) => row[field] !== value)
          const deleted = before - state.entries.length
          return Promise.resolve({ data: null, error: deleted >= 0 ? null : new Error('delete_failed') })
        }

        return builder
      }),
      single: vi.fn(async () => {
        if (operation === 'insert') {
          const row = { id: nextEntryId(), ...insertPayload }
          state.entries.push(row)
          return { data: row, error: null }
        }

        if (operation === 'update') {
          const idx = state.entries.findIndex((row) => row[filterField] === filterValue)
          if (idx === -1) return { data: null, error: { message: 'Not found' } }
          state.entries[idx] = { ...state.entries[idx], ...updatePayload }
          return { data: state.entries[idx], error: null }
        }

        const row = state.entries.find((item) => item[filterField] === filterValue)
        if (!row) return { data: null, error: { message: 'Not found' } }
        return { data: row, error: null }
      }),
      insert: vi.fn((payload) => {
        operation = 'insert'
        insertPayload = payload
        return builder
      }),
      update: vi.fn((payload) => {
        operation = 'update'
        updatePayload = payload
        return builder
      }),
      delete: vi.fn(() => {
        operation = 'delete'
        return builder
      }),
    }

    return builder
  }

  const storageBucket = {
    upload: vi.fn(async (path) => {
      state.photos.add(path)
      return { error: null }
    }),
    getPublicUrl: vi.fn((path) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    })),
    remove: vi.fn(async (paths) => {
      paths.forEach((path) => state.photos.delete(path))
      return { error: null }
    }),
  }

  const mockSupabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user } })),
    },
    storage: {
      from: vi.fn(() => storageBucket),
    },
    from: vi.fn((table) => {
      if (table === 'entries') {
        return makeEntriesQueryBuilder()
      }

      throw new Error(`Unexpected table access in E2E flow: ${table}`)
    }),
  }

  return { state, mockSupabase }
})

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}))

import { createEntry, deleteEntry, getEntries, getEntry, updateEntry } from '../lib/entries'
import { deletePhoto, uploadPhoto } from '../lib/storage'

describe('Phase 1 core loop E2E (service-level)', () => {
  beforeEach(() => {
    state.entries = []
    state.photos.clear()
    vi.clearAllMocks()

    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
  })

  it('runs create -> read -> update -> delete for a meal entry with photo', async () => {
    const photoFile = new File(['binary'], 'meal.jpg', { type: 'image/jpeg' })
    const upload = await uploadPhoto(photoFile)

    expect(upload.error).toBeNull()
    expect(upload.path).toMatch(/^user-e2e\/1700000000000-/)
    expect(state.photos.has(upload.path)).toBe(true)

    const created = await createEntry({
      dish_name: 'Paneer Butter Masala',
      venue_name: 'Mabrouk',
      entry_type: 'eating_out',
      notes: 'Great texture',
      ate_at: '2026-03-01T12:00:00.000Z',
      photo_url: upload.url,
      photo_path: upload.path,
    })

    expect(created.error).toBeNull()
    expect(created.data.user_id).toBe('user-e2e')
    expect(state.entries).toHaveLength(1)

    const listed = await getEntries()
    expect(listed.error).toBeNull()
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0].dish_name).toBe('Paneer Butter Masala')

    const updated = await updateEntry(created.data.id, {
      notes: 'Even better on second bite',
      rating: 5,
    })
    expect(updated.error).toBeNull()
    expect(updated.data.notes).toBe('Even better on second bite')
    expect(updated.data.rating).toBe(5)

    const fetched = await getEntry(created.data.id)
    expect(fetched.error).toBeNull()
    expect(fetched.data.id).toBe(created.data.id)
    expect(fetched.data.photo_path).toBe(upload.path)

    const deleted = await deleteEntry(created.data.id)
    expect(deleted.error).toBeNull()
    expect(state.entries).toHaveLength(0)

    const photoDeleted = await deletePhoto(upload.path)
    expect(photoDeleted.error).toBeNull()
    expect(state.photos.has(upload.path)).toBe(false)
  })
})
