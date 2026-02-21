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

const MAX_HEIC_BYTES = 20 * 1024 * 1024

export async function resizeForAnalysis(file) {
  if (!file) throw new Error('No file provided')

  if (isHeic(file)) {
    if (file.size > MAX_HEIC_BYTES) {
      throw new Error('file_too_large')
    }
    const heic2any = (await import('heic2any')).default
    const jpegBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8,
    })
    file = new File(
      [Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob],
      toJpegName(file.name),
      { type: 'image/jpeg' }
    )
  }

  return new Promise((resolve, reject) => {
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
