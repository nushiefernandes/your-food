import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockBucket = {
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  storage: {
    from: vi.fn(() => mockBucket),
  },
}

vi.mock('./supabase', () => ({
  supabase: mockSupabase,
}))

import { deletePhoto, uploadPhoto } from './storage'

describe('storage lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.storage.from.mockReturnValue(mockBucket)
  })

  it('uploadPhoto returns error when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await uploadPhoto(new File(['img'], 'meal.jpg', { type: 'image/jpeg' }))

    expect(result.url).toBeNull()
    expect(result.path).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toBe('Not authenticated')
    expect(mockBucket.upload).not.toHaveBeenCalled()
  })

  it('uploadPhoto stores file and returns public URL + storage path', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockBucket.upload.mockResolvedValue({ error: null })
    mockBucket.getPublicUrl.mockImplementation((path) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }))

    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' })
    const result = await uploadPhoto(file)

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('meal-photos')
    expect(mockBucket.upload).toHaveBeenCalledTimes(1)
    const [pathArg, fileArg] = mockBucket.upload.mock.calls[0]
    expect(pathArg).toMatch(/^user-1\/1700000000000-/)
    expect(pathArg.endsWith('.jpg')).toBe(true)
    expect(fileArg).toBe(file)

    expect(result.error).toBeNull()
    expect(result.path).toBe(pathArg)
    expect(result.url).toBe(`https://cdn.example/${pathArg}`)
  })

  it('uploadPhoto returns upload error when storage upload fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const uploadError = new Error('storage_failed')
    mockBucket.upload.mockResolvedValue({ error: uploadError })

    const result = await uploadPhoto(new File(['img'], 'meal.jpg', { type: 'image/jpeg' }))

    expect(result).toEqual({ url: null, path: null, error: uploadError })
    expect(mockBucket.getPublicUrl).not.toHaveBeenCalled()
  })

  it('deletePhoto removes path from storage bucket', async () => {
    mockBucket.remove.mockResolvedValue({ error: null })

    const result = await deletePhoto('user-1/abc.jpg')

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('meal-photos')
    expect(mockBucket.remove).toHaveBeenCalledWith(['user-1/abc.jpg'])
    expect(result).toEqual({ error: null })
  })
})
