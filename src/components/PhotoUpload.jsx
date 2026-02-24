import { useState, useRef, useEffect } from 'react'
import { isHeic, extractExifData } from '../lib/imageUtils'

function PhotoUpload({ existingUrl, onFileSelect, onClear }) {
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null)
  const [isHeicPreview, setIsHeicPreview] = useState(false)
  const [conversionError, setConversionError] = useState(null)
  const inputRef = useRef(null)
  const selectionIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== existingUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, existingUrl])

  async function handleFileChange(e) {
    const currentId = selectionIdRef.current + 1
    selectionIdRef.current = currentId

    const file = e.target.files[0]
    if (!file) return

    const exifData = await extractExifData(file)
    if (selectionIdRef.current !== currentId) return

    setConversionError(null)

    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const isHeicFile = isHeic(file)

    if (isHeicFile) {
      setIsHeicPreview(true)
      setPreviewUrl(null)
      let timeoutId
      try {
        const heic2any = (await import('heic2any')).default
        if (selectionIdRef.current !== currentId) return

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('heic_timeout'))
          }, 15000)
        })

        const jpegBlob = await Promise.race([
          heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8,
          }),
          timeoutPromise,
        ])
        clearTimeout(timeoutId)
        if (selectionIdRef.current !== currentId) return

        const blob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob
        const convertedFile = new File(
          [blob],
          file.name.replace(/\.[^/.]+$/, '.jpg'),
          { type: 'image/jpeg', lastModified: Date.now() }
        )
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setIsHeicPreview(false)
        onFileSelect(convertedFile, exifData)
      } catch (err) {
        if (typeof timeoutId !== 'undefined') {
          clearTimeout(timeoutId)
        }
        if (selectionIdRef.current !== currentId) return
        if (import.meta.env.DEV) {
          console.error('[PhotoUpload] HEIC conversion failed:', err)
        }
        setIsHeicPreview(false)
        setPreviewUrl(null)
        setConversionError(
          err?.message === 'heic_timeout'
            ? 'Photo conversion took too long. Try a JPEG instead.'
            : 'Could not convert this photo. Try a JPEG instead.'
        )
      }
    } else {
      setIsHeicPreview(false)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelect(file, exifData)
    }
  }

  function handleClear() {
    selectionIdRef.current += 1
    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setIsHeicPreview(false)
    setConversionError(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear()
  }

  if (previewUrl || isHeicPreview) {
    return (
      <div className="relative mb-4">
        {isHeicPreview && !previewUrl ? (
          <div className="w-full h-48 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
            Converting photo...
          </div>
        ) : (
          <img
            src={previewUrl}
            alt="Meal preview"
            className="w-full h-48 object-cover rounded-lg"
          />
        )}
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-2 right-2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          &times;
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full h-32 border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-500 transition-colors cursor-pointer"
      >
        <span className="text-2xl mb-1">+</span>
        <span className="text-sm">Add a photo</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/heic,image/heif,image/jpeg,image/png,image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {conversionError && (
        <p className="text-xs text-red-500 mt-2">{conversionError}</p>
      )}
    </div>
  )
}

export default PhotoUpload
