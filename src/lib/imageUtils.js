export function isHeic(file) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  )
}

export async function extractExifData(file) {
  try {
    const exifr = await import('exifr')
    const result = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'Orientation', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
      gps: true,
    })

    if (!result) return null

    const timestamp =
      result.DateTimeOriginal instanceof Date &&
      !Number.isNaN(result.DateTimeOriginal.getTime())
        ? result.DateTimeOriginal
        : null

    const latitude = result.latitude ?? result.GPSLatitude
    const longitude = result.longitude ?? result.GPSLongitude

    const lat = typeof latitude === 'number' ? latitude : null
    const lng = typeof longitude === 'number' ? longitude : null
    const orientation = typeof result.Orientation === 'number' ? result.Orientation : null

    return { timestamp, lat, lng, orientation }
  } catch (error) {
    return null
  }
}

function toJpegName(originalName) {
  const base = originalName.replace(/\.[^/.]+$/, '')
  return `${base}.jpg`
}

export async function resizeForAnalysis(file, orientation) {
  if (!file) throw new Error('No file provided')

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
      const resolvedOrientation = typeof orientation === 'number' ? orientation : null
      const shouldSwapDimensions =
        resolvedOrientation === 5 ||
        resolvedOrientation === 6 ||
        resolvedOrientation === 7 ||
        resolvedOrientation === 8

      canvas.width = shouldSwapDimensions ? targetHeight : targetWidth
      canvas.height = shouldSwapDimensions ? targetWidth : targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      if (resolvedOrientation && resolvedOrientation !== 1) {
        switch (resolvedOrientation) {
          case 2:
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
            break
          case 3:
            ctx.translate(canvas.width, canvas.height)
            ctx.rotate(Math.PI)
            break
          case 4:
            ctx.translate(0, canvas.height)
            ctx.scale(1, -1)
            break
          case 5:
            ctx.translate(canvas.width, 0)
            ctx.rotate(Math.PI / 2)
            ctx.scale(-1, 1)
            break
          case 6:
            ctx.translate(canvas.width, 0)
            ctx.rotate(Math.PI / 2)
            break
          case 7:
            ctx.translate(0, canvas.height)
            ctx.rotate(-Math.PI / 2)
            ctx.scale(-1, 1)
            break
          case 8:
            ctx.translate(0, canvas.height)
            ctx.rotate(-Math.PI / 2)
            break
        }
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

export async function processFiles(rawFiles, existingCount = 0) {
  const batch = Array.from(rawFiles).slice(0, 9 - existingCount)
  if (batch.length === 0) return []

  return Promise.all(batch.map(async (file) => {
    const exif = await extractExifData(file)

    let processedFile = file
    if (isHeic(file)) {
      let timeoutId
      try {
        const heic2any = (await import('heic2any')).default
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('heic_timeout')), 15000)
        })
        const jpegBlob = await Promise.race([
          heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 }),
          timeoutPromise,
        ])
        clearTimeout(timeoutId)
        const blob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob
        processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
      } catch (err) {
        if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId)
        const type = err?.message === 'heic_timeout' ? 'heic_timeout' : 'heic_error'
        throw { type, fileName: file.name }
      }
    }

    return {
      id: crypto.randomUUID(),
      rawFile: processedFile,
      previewUrl: URL.createObjectURL(processedFile),
      exif,
    }
  }))
}
