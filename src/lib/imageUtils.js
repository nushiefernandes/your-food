function isHeic(file) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  )
}

function toJpegName(originalName) {
  const base = originalName.replace(/\.[^/.]+$/, '')
  return `${base}.jpg`
}

export function resizeForAnalysis(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'))
      return
    }

    if (isHeic(file)) {
      reject(new Error('heic_unsupported'))
      return
    }

    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const maxDimension = 1024
      const { width, height } = image

      const longestEdge = Math.max(width, height)
      const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1
      const targetWidth = Math.round(width * scale)
      const targetHeight = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image'))
            return
          }

          const jpegFile = new File([blob], toJpegName(file.name), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          resolve(jpegFile)
        },
        'image/jpeg',
        0.8,
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    image.src = objectUrl
  })
}
