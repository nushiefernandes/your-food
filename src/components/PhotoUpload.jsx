import { useRef } from 'react'

function PhotoUpload({
  photos,
  onFilesAdded,
  onPhotoRemoved,
  isProcessing,
  processingError,
  maxPhotos = 9,
}) {
  const inputRef = useRef(null)

  return (
    <div className="mb-4 space-y-2">
      {isProcessing && (
        <div className="w-full h-20 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
          Converting photo...
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative w-16 h-16">
            <img src={photo.previewUrl} className="w-full h-full object-cover rounded-lg" alt="" />
            <button
              type="button"
              onClick={() => onPhotoRemoved(photo.id)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
            >
              &times;
            </button>
            {i === 0 && photos.length > 1 && (
              <span className="absolute bottom-0 left-0 bg-black/50 text-white text-[9px] px-1 rounded-br-lg">
                Primary
              </span>
            )}
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 text-xl hover:border-gray-400 transition-colors"
          >
            +
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/heic,image/heif,image/jpeg,image/png,image/*"
        onChange={(e) => {
          onFilesAdded(Array.from(e.target.files || []))
        }}
        className="hidden"
      />
      {processingError && (
        <p className="text-xs text-red-500 mt-2">{processingError}</p>
      )}
    </div>
  )
}

export default PhotoUpload
