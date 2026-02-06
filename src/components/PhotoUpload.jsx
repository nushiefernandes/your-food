import { useState, useRef, useEffect } from 'react'

function PhotoUpload({ existingUrl, onFileSelect, onClear }) {
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null)
  const inputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== existingUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, existingUrl])

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    onFileSelect(file)
  }

  function handleClear() {
    if (previewUrl && previewUrl !== existingUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear()
  }

  if (previewUrl) {
    return (
      <div className="relative mb-4">
        <img
          src={previewUrl}
          alt="Meal preview"
          className="w-full h-48 object-cover rounded-lg"
        />
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
