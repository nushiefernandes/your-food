import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBucket, mockSupabase } = vi.hoisted(() => ({
  mockBucket: {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
  },
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}))

vi.mock('./supabase', () => ({
  supabase: mockSupabase,
}))

import { deletePhoto, uploadPhoto, uploadPhotos } from './storage'

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

  it('uploadPhotos uploads all files and returns all results', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockBucket.upload.mockResolvedValue({ error: null })
    mockBucket.getPublicUrl.mockImplementation((path) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }))

    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.7)

    const file1 = new File(['img-1'], 'meal-1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['img-2'], 'meal-2.jpg', { type: 'image/jpeg' })

    const result = await uploadPhotos([file1, file2])
    const [path1] = mockBucket.upload.mock.calls[0]
    const [path2] = mockBucket.upload.mock.calls[1]

    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(2)
    expect(mockBucket.upload).toHaveBeenCalledTimes(2)
    expect(mockBucket.upload).toHaveBeenNthCalledWith(1, path1, file1)
    expect(mockBucket.upload).toHaveBeenNthCalledWith(2, path2, file2)
    expect(result).toEqual([
      { url: `https://cdn.example/${path1}`, path: path1, error: null },
      { url: `https://cdn.example/${path2}`, path: path2, error: null },
    ])
  })

  it('deletePhoto removes path from storage bucket', async () => {
    mockBucket.remove.mockResolvedValue({ error: null })

    const result = await deletePhoto('user-1/abc.jpg')

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('meal-photos')
    expect(mockBucket.remove).toHaveBeenCalledWith(['user-1/abc.jpg'])
    expect(result).toEqual({ error: null })
  })
})
