import { useCallback, useEffect, useRef, useState } from 'react'
import { processFiles, resizeForAnalysis } from '../lib/imageUtils'
import { uploadPhoto, deletePhoto } from '../lib/storage'
import { analyzeDishPhotos, filterByConfidence } from '../lib/analysis'

const AI_FIELDS = new Set(['dish_name', 'cuisine_type', 'entry_type'])

const IDLE = {
  status: 'idle',
  suggestions: null,
  aiFields: new Set(),
  uploadResults: [],
  error: null,
}

export function useMultiPhotoAnalysis() {
  const [photos, setPhotos] = useState([])
  const [processing, setProcessing] = useState(false)
  const [processingError, setProcessingError] = useState(null)
  const [analysis, setAnalysis] = useState(IDLE)
  const uploadCacheRef = useRef(new Map())
  const claimedRef = useRef(false)
  const sessionRef = useRef(0)
  const photosRef = useRef([])

  useEffect(() => { photosRef.current = photos }, [photos])

  async function runAnalysis(currentPhotos) {
    const session = ++sessionRef.current
    claimedRef.current = false
    setAnalysis({ ...IDLE, status: 'uploading' })

    try {
      await Promise.all(currentPhotos.map(async (photo) => {
        if (uploadCacheRef.current.has(photo.id)) return
        if (!photo.rawFile) return
        const resized = await resizeForAnalysis(photo.rawFile, photo.exif?.orientation)
        const result = await uploadPhoto(resized)
        if (!result.error) uploadCacheRef.current.set(photo.id, { path: result.path, url: result.url })
      }))
    } catch (err) {
      if (sessionRef.current !== session) return
      const code = err?.message === 'file_too_large' ? 'file_too_large' : 'resize_failed'
      setAnalysis({ ...IDLE, status: 'error', error: code })
      return
    }

    if (sessionRef.current !== session) return

    const paths = currentPhotos.map(p => uploadCacheRef.current.get(p.id)?.path).filter(Boolean)

    if (paths.length === 0) {
      setAnalysis({ ...IDLE, status: 'error', error: 'upload_failed' })
      return
    }

    const uploadResults = currentPhotos.map(p => uploadCacheRef.current.get(p.id)).filter(Boolean)

    setAnalysis(prev => sessionRef.current === session
      ? { ...IDLE, status: 'analyzing', uploadResults }
      : prev)

    const result = await analyzeDishPhotos(paths)
    if (sessionRef.current !== session) return

    if (result?.error) {
      setAnalysis(prev => sessionRef.current === session
        ? { ...IDLE, status: 'error', error: result.error, uploadResults }
        : prev)
      return
    }

    const allFiltered = result?.suggestions ? filterByConfidence(result.suggestions) : null
    const filtered = allFiltered
      ? Object.fromEntries(Object.entries(allFiltered).filter(([k]) => AI_FIELDS.has(k)))
      : null

    setAnalysis({
      status: 'done',
      suggestions: filtered,
      aiFields: new Set(filtered ? Object.keys(filtered) : []),
      uploadResults,
      error: null,
    })
  }

  const addFiles = useCallback(async (rawFiles) => {
    setProcessing(true)
    setProcessingError(null)

    let newPhotos
    try {
      newPhotos = await processFiles(rawFiles, photos.length)
    } catch (err) {
      setProcessingError(err.type ?? 'heic_error')
      setProcessing(false)
      return
    }

    setPhotos((prev) => {
      const combined = [...prev, ...newPhotos]
      runAnalysis(combined)
      return combined
    })

    setProcessing(false)
  }, [photos.length])

  const removePhoto = useCallback((id) => {
    const photo = photos.find(p => p.id === id)
    if (!photo) return

    if (photo.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photo.previewUrl)
    }

    if (uploadCacheRef.current.has(id)) {
      deletePhoto(uploadCacheRef.current.get(id).path)
      uploadCacheRef.current.delete(id)
    }

    const remaining = photos.filter(p => p.id !== id)
    setPhotos(remaining)

    if (remaining.length > 0) {
      runAnalysis(remaining)
    }

    if (remaining.length === 0) {
      setAnalysis(IDLE)
    }
  }, [photos])

  const clearAll = useCallback(() => {
    photos.forEach((p) => {
      if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl)
    })

    if (!claimedRef.current) {
      uploadCacheRef.current.forEach(({ path }) => deletePhoto(path))
    }

    uploadCacheRef.current = new Map()
    setPhotos([])
    setAnalysis(IDLE)
    setProcessingError(null)
  }, [photos])

  const seedExistingPhotos = useCallback((existingPhotos) => {
    const seeded = existingPhotos.map(({ url, path }) => {
      const id = crypto.randomUUID()
      uploadCacheRef.current.set(id, { path, url })
      return { id, rawFile: null, previewUrl: url, exif: null }
    })
    setPhotos(seeded)
  }, [])

  useEffect(() => {
    return () => {
      photosRef.current.forEach(p => {
        if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl)
      })
      if (!claimedRef.current) {
        uploadCacheRef.current.forEach(({ path }) => deletePhoto(path))
      }
    }
  }, [])

  const claimUploads = useCallback(() => { claimedRef.current = true }, [])

  return { photos, processing, processingError, analysis, addFiles, removePhoto, clearAll, seedExistingPhotos, claimUploads }
}
