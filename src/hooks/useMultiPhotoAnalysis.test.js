// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMultiPhotoAnalysis } from './useMultiPhotoAnalysis'
import { processFiles, resizeForAnalysis } from '../lib/imageUtils'
import { uploadPhoto, deletePhoto } from '../lib/storage'
import { analyzeDishPhotos, filterByConfidence } from '../lib/analysis'

vi.mock('../lib/imageUtils', () => ({ processFiles: vi.fn(), resizeForAnalysis: vi.fn() }))
vi.mock('../lib/storage', () => ({ uploadPhoto: vi.fn(), deletePhoto: vi.fn() }))
vi.mock('../lib/analysis', () => ({ analyzeDishPhotos: vi.fn(), filterByConfidence: vi.fn() }))

// ─── Helpers ────────────────────────────────────────────────────────────────

let _n = 0
beforeEach(() => { _n = 0 })

function uid() { return `photo-${++_n}` }

function makePhoto(overrides = {}) {
  const id = uid()
  return {
    id,
    rawFile: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${id}`,
    exif: null,
    ...overrides,
  }
}

function makeResized() {
  return new File(['r'], 'resized.jpg', { type: 'image/jpeg' })
}

function uploadResult(path = `user/p-${_n}.jpg`) {
  return { path, url: `https://cdn/${path}`, error: null }
}

// Sets up all mocks for the normal happy path
function happy(photos) {
  processFiles.mockResolvedValue(photos)
  resizeForAnalysis.mockResolvedValue(makeResized())
  uploadPhoto.mockResolvedValue(uploadResult())
  analyzeDishPhotos.mockResolvedValue({ suggestions: null })
  filterByConfidence.mockReturnValue(null)
}

// Adds files and waits for analysis to settle (idle or done or error)
async function addAndSettle(hook, files = [new File(['x'], 'f.jpg')]) {
  await act(async () => { await hook.addFiles(files) })
  await waitFor(() => expect(['idle', 'done', 'error']).toContain(hook.analysis.status))
}

// ─── addFiles ───────────────────────────────────────────────────────────────

describe('addFiles', () => {
  it('adds returned photos to the photos array', async () => {
    const photo = makePhoto()
    happy([photo])
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)

    expect(result.current.photos).toHaveLength(1)
    expect(result.current.photos[0].id).toBe(photo.id)
  })

  it('accumulates photos across multiple addFiles calls', async () => {
    const p1 = makePhoto(); const p2 = makePhoto()
    processFiles.mockResolvedValueOnce([p1]).mockResolvedValueOnce([p2])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue(uploadResult())
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)
    await addAndSettle(result.current)

    expect(result.current.photos).toHaveLength(2)
    expect(result.current.photos.map(p => p.id)).toEqual([p1.id, p2.id])
  })

  it('uploads each photo exactly once — no re-upload of already-cached photos', async () => {
    const p1 = makePhoto(); const p2 = makePhoto()
    processFiles.mockResolvedValueOnce([p1]).mockResolvedValueOnce([p2])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto
      .mockResolvedValueOnce({ path: 'user/p1.jpg', url: 'https://cdn/p1', error: null })
      .mockResolvedValueOnce({ path: 'user/p2.jpg', url: 'https://cdn/p2', error: null })
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)
    await addAndSettle(result.current)

    // This is the key regression test: photo 1 must NOT be re-uploaded when photo 2 is added
    expect(uploadPhoto).toHaveBeenCalledTimes(2)
  })

  it('is processing:true while processFiles runs, then false', async () => {
    let resolve
    processFiles.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    act(() => { result.current.addFiles([new File(['x'], 'f.jpg')]) })
    expect(result.current.processing).toBe(true)

    await act(async () => { resolve([]) })
    expect(result.current.processing).toBe(false)
  })

  it('sets processingError and does not upload when HEIC conversion fails', async () => {
    processFiles.mockRejectedValue({ type: 'heic_timeout' })
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await act(async () => { await result.current.addFiles([new File(['x'], 'f.heic')]) })

    expect(result.current.processingError).toBe('heic_timeout')
    expect(result.current.photos).toHaveLength(0)
    expect(uploadPhoto).not.toHaveBeenCalled()
  })

  it('reaches done status and populates suggestions on successful analysis', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/p.jpg', url: 'https://cdn/p', error: null })
    analyzeDishPhotos.mockResolvedValue({
      suggestions: {
        dish_name: { value: 'Biryani', confidence: 0.92 },
        cuisine_type: { value: 'North Indian', confidence: 0.88 },
        entry_type: { value: 'eating_out', confidence: 0.80 },
      },
    })
    filterByConfidence.mockReturnValue({
      dish_name: 'Biryani',
      cuisine_type: 'North Indian',
      entry_type: 'eating_out',
    })

    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await act(async () => { await result.current.addFiles([photo.rawFile]) })
    await waitFor(() => expect(result.current.analysis.status).toBe('done'))

    expect(result.current.analysis.suggestions?.dish_name).toBe('Biryani')
    expect(result.current.analysis.suggestions?.cuisine_type).toBe('North Indian')
    expect(result.current.analysis.aiFields.has('dish_name')).toBe(true)
  })
})

// ─── removePhoto ────────────────────────────────────────────────────────────

describe('removePhoto', () => {
  it('removes the correct photo by id, leaving others intact', async () => {
    const [p1, p2, p3] = [makePhoto(), makePhoto(), makePhoto()]
    processFiles.mockResolvedValue([p1, p2, p3])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue(uploadResult())
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)

    act(() => { result.current.removePhoto(p2.id) })

    expect(result.current.photos.map(p => p.id)).toEqual([p1.id, p3.id])
  })

  it('revokes the blob URL of the removed photo', async () => {
    const photo = makePhoto({ previewUrl: 'blob:revoke-me' })
    happy([photo])
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)
    act(() => { result.current.removePhoto(photo.id) })

    expect(revoke).toHaveBeenCalledWith('blob:revoke-me')
  })

  it('deletes the storage upload for the removed photo', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/delete-me.jpg', url: 'https://cdn/x', error: null })
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)

    act(() => { result.current.removePhoto(photo.id) })
    await waitFor(() => expect(deletePhoto).toHaveBeenCalledWith('user/delete-me.jpg'))
  })

  it('resets to idle when the last photo is removed', async () => {
    const photo = makePhoto()
    happy([photo])
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)
    act(() => { result.current.removePhoto(photo.id) })

    expect(result.current.photos).toHaveLength(0)
    expect(result.current.analysis.status).toBe('idle')
  })

  it('does not revoke non-blob URLs (existing DB photos)', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('seed-id-1')

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    act(() => {
      result.current.seedExistingPhotos([{ url: 'https://cdn/existing.jpg', path: 'user/existing.jpg' }])
    })

    act(() => { result.current.removePhoto('seed-id-1') })

    expect(revoke).not.toHaveBeenCalledWith('https://cdn/existing.jpg')
  })
})

// ─── clearAll ───────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('empties photos array and resets analysis to idle', async () => {
    const photo = makePhoto()
    happy([photo])
    const { result } = renderHook(() => useMultiPhotoAnalysis())

    await addAndSettle(result.current)
    act(() => { result.current.clearAll() })

    expect(result.current.photos).toHaveLength(0)
    expect(result.current.analysis.status).toBe('idle')
  })

  it('revokes all blob URLs on clear', async () => {
    const [p1, p2] = [makePhoto({ previewUrl: 'blob:a' }), makePhoto({ previewUrl: 'blob:b' })]
    processFiles.mockResolvedValue([p1, p2])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue(uploadResult())
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })
    const revoke = vi.spyOn(URL, 'revokeObjectURL')

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)
    act(() => { result.current.clearAll() })

    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(revoke).toHaveBeenCalledWith('blob:b')
  })

  it('deletes all unclaimed uploads on clear', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/clear-me.jpg', url: 'https://cdn/c', error: null })
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)
    act(() => { result.current.clearAll() })

    expect(deletePhoto).toHaveBeenCalledWith('user/clear-me.jpg')
  })
})

// ─── claimUploads ───────────────────────────────────────────────────────────

describe('claimUploads', () => {
  it('prevents upload deletion on unmount after claiming (simulate successful save)', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/claimed.jpg', url: 'https://cdn/c', error: null })
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })
    deletePhoto.mockResolvedValue({})

    const { result, unmount } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)
    act(() => { result.current.claimUploads() })

    unmount()

    expect(deletePhoto).not.toHaveBeenCalledWith('user/claimed.jpg')
  })

  it('deletes uploads on unmount when NOT claimed (simulate navigation away)', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/unclaimed.jpg', url: 'https://cdn/u', error: null })
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })
    deletePhoto.mockResolvedValue({})

    const { result, unmount } = renderHook(() => useMultiPhotoAnalysis())
    await addAndSettle(result.current)
    // deliberately do NOT call claimUploads

    unmount()

    expect(deletePhoto).toHaveBeenCalledWith('user/unclaimed.jpg')
  })
})

// ─── seedExistingPhotos ─────────────────────────────────────────────────────

describe('seedExistingPhotos', () => {
  it('creates photos with rawFile: null and preserves original URLs', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('seed-a')
      .mockReturnValueOnce('seed-b')

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    act(() => {
      result.current.seedExistingPhotos([
        { url: 'https://cdn/img1.jpg', path: 'user/img1.jpg' },
        { url: 'https://cdn/img2.jpg', path: 'user/img2.jpg' },
      ])
    })

    expect(result.current.photos).toHaveLength(2)
    expect(result.current.photos[0].rawFile).toBeNull()
    expect(result.current.photos[0].previewUrl).toBe('https://cdn/img1.jpg')
    expect(result.current.photos[1].previewUrl).toBe('https://cdn/img2.jpg')
  })

  it('pre-populates upload cache so existing photos are never re-uploaded when a new photo is added', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('seed-id')
    analyzeDishPhotos.mockResolvedValue({ suggestions: null })

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    act(() => {
      result.current.seedExistingPhotos([{ url: 'https://cdn/existing.jpg', path: 'user/existing.jpg' }])
    })

    // Now add a new photo on top
    const newPhoto = makePhoto()
    processFiles.mockResolvedValue([newPhoto])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: 'user/new.jpg', url: 'https://cdn/new', error: null })

    await addAndSettle(result.current)

    // Only the NEW photo should have been uploaded — existing one was already in cache
    expect(uploadPhoto).toHaveBeenCalledTimes(1)
  })
})

// ─── runAnalysis error handling ─────────────────────────────────────────────

describe('runAnalysis error handling', () => {
  it('sets status:error (not stuck at uploading) when resize throws', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockRejectedValue(new Error('Failed to load image'))

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await act(async () => { await result.current.addFiles([photo.rawFile]) })
    await waitFor(() => expect(result.current.analysis.status).toBe('error'))

    expect(result.current.analysis.error).toBe('resize_failed')
  })

  it('surfaces file_too_large error code when resize throws with that message', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockRejectedValue(new Error('file_too_large'))

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await act(async () => { await result.current.addFiles([photo.rawFile]) })
    await waitFor(() => expect(result.current.analysis.status).toBe('error'))

    expect(result.current.analysis.error).toBe('file_too_large')
  })

  it('sets status:error when all uploads fail (e.g. not authenticated)', async () => {
    const photo = makePhoto()
    processFiles.mockResolvedValue([photo])
    resizeForAnalysis.mockResolvedValue(makeResized())
    uploadPhoto.mockResolvedValue({ path: null, url: null, error: new Error('Not authenticated') })

    const { result } = renderHook(() => useMultiPhotoAnalysis())
    await act(async () => { await result.current.addFiles([photo.rawFile]) })
    await waitFor(() => expect(result.current.analysis.status).toBe('error'))

    expect(result.current.analysis.error).toBe('upload_failed')
  })
})
