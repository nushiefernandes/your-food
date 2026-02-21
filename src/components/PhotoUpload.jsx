import { useState, useRef, useEffect } from 'react'

function PhotoUpload({ existingUrl, onFileSelect, onClear }) {
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null)
  const [isHeicPreview, setIsHeicPreview] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== existingUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, existingUrl])

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const isHeicFile =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name)

    if (isHeicFile) {
      setIsHeicPreview(true)
      setPreviewUrl(null)
      onFileSelect(file)
      try {
        const heic2any = (await import('heic2any')).default
        const jpegBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.5,
        })
        const blob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setIsHeicPreview(false)
      } catch {
        // Preview conversion failed — placeholder stays, analysis still runs
      }
    } else {
      setIsHeicPreview(false)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelect(file)
    }
  }

  function handleClear() {
    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setIsHeicPreview(false)
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
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

export default PhotoUpload
