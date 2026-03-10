import { useState, useRef, useEffect } from 'react'
import { isHeic, extractExifData } from '../lib/imageUtils'

function PhotoUpload({ existingUrls = [], onFilesSelect, onClear }) {
  const [previews, setPreviews] = useState(existingUrls)
  const [files, setFiles] = useState([])
  const [exifData, setExifData] = useState([])
  const [isHeicPreview, setIsHeicPreview] = useState(false)
  const [conversionError, setConversionError] = useState(null)
  const inputRef = useRef(null)
  const selectionIdRef = useRef(0)

  useEffect(() => {
    return () => {
      previews
        .filter((preview) => preview.startsWith('blob:'))
        .forEach((preview) => URL.revokeObjectURL(preview))
    }
  }, [previews])

  async function handleFileChange(e) {
    const currentId = selectionIdRef.current + 1
    selectionIdRef.current = currentId

    const files = Array.from(e.target.files || []).slice(0, 9)
    if (files.length === 0) return

    previews
      .filter((preview) => preview.startsWith('blob:'))
      .forEach((preview) => URL.revokeObjectURL(preview))

    const exifResults = await Promise.all(files.map((file) => extractExifData(file)))
    if (selectionIdRef.current !== currentId) return

    setConversionError(null)

    let primaryFile = files[0]
    const isHeicFile = isHeic(primaryFile)

    if (isHeicFile && primaryFile) {
      setIsHeicPreview(true)
      setPreviews([])
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
            blob: primaryFile,
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
          primaryFile.name.replace(/\.[^/.]+$/, '.jpg'),
          { type: 'image/jpeg', lastModified: Date.now() }
        )
        primaryFile = convertedFile
      } catch (err) {
        if (typeof timeoutId !== 'undefined') {
          clearTimeout(timeoutId)
        }
        if (selectionIdRef.current !== currentId) return
        if (import.meta.env.DEV) {
          console.error('[PhotoUpload] HEIC conversion failed:', err)
        }
        setIsHeicPreview(false)
        setPreviews([])
        setConversionError(
          err?.message === 'heic_timeout'
            ? 'Photo conversion took too long. Try a JPEG instead.'
            : 'Could not convert this photo. Try a JPEG instead.'
        )
        return
      }
    }

    if (selectionIdRef.current !== currentId) return
    setIsHeicPreview(false)

    const allFiles = [primaryFile, ...files.slice(1)]
    const nextPreviews = allFiles.map((file) => URL.createObjectURL(file))
    setPreviews(nextPreviews)
    setFiles(allFiles)
    setExifData(exifResults)
    if (onFilesSelect) onFilesSelect(allFiles, exifResults)
  }

  function handleClear() {
    selectionIdRef.current += 1
    previews
      .filter((preview) => preview.startsWith('blob:'))
      .forEach((preview) => URL.revokeObjectURL(preview))
    setPreviews([])
    setFiles([])
    setExifData([])
    setIsHeicPreview(false)
    setConversionError(null)
    if (inputRef.current) inputRef.current.value = ''
    if (onClear) onClear()
  }

  function removePhoto(index) {
    URL.revokeObjectURL(previews[index])
    const newPreviews = previews.filter((_, i) => i !== index)
    const newFiles = files.filter((_, i) => i !== index)
    const newExifData = exifData.filter((_, i) => i !== index)
    setPreviews(newPreviews)
    setFiles(newFiles)
    setExifData(newExifData)
    if (newFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = ''
      if (onClear) onClear()
    } else {
      if (onFilesSelect) onFilesSelect(newFiles, newExifData)
    }
  }

  return (
    <div className="mb-4 space-y-2">
      {isHeicPreview && previews.length === 0 && (
        <div className="w-full h-20 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
          Converting photo...
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div key={i} className="relative w-16 h-16">
            <img src={src} className="w-full h-full object-cover rounded-lg" alt="" />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
            >
              &times;
            </button>
            {i === 0 && previews.length > 1 && (
              <span className="absolute bottom-0 left-0 bg-black/50 text-white text-[9px] px-1 rounded-br-lg">
                Primary
              </span>
            )}
          </div>
        ))}
        {previews.length < 9 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 text-xl hover:border-gray-400 transition-colors"
          >
            {previews.length === 0 ? '📷' : '+'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
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
