import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from '../constants'

/** Browser-side validation so users get instant feedback before any upload. */
export function validateFile(file: File, maxBytes = MAX_UPLOAD_BYTES): string | null {
  if (!file || file.size === 0) return 'That file is empty.'
  if (file.size > maxBytes) {
    return `That image is ${(file.size / 1e6).toFixed(1)} MB — the limit is ${Math.round(maxBytes / 1e6)} MB.`
  }
  const mime = file.type || 'unknown'
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)) {
    return `Unsupported file type (${mime || 'unknown'}). Use a PNG, JPG or WebP screenshot.`
  }
  return null
}

export interface PreparedFile {
  file: File
  /** True when we upscaled a tiny screenshot client-side for better OCR. */
  upscaled: boolean
  width: number
  height: number
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The file could not be opened as an image.'))
    }
    image.src = url
  })
}

/**
 * Tiny screenshots OCR badly. Upscaling them in the browser (canvas, GPU) is
 * free and keeps the server contract simple: it always receives a good image.
 */
export async function prepareForUpload(file: File): Promise<PreparedFile> {
  const { image, url } = await loadImage(file)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const longest = Math.max(width, height)
  try {
    if (longest >= 1000 || longest === 0) return { file, upscaled: false, width, height }

    const scale = Math.min(3, Math.ceil(1400 / longest))
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const context = canvas.getContext('2d')
    if (!context) return { file, upscaled: false, width, height }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return { file, upscaled: false, width, height }
    return {
      file: new File([blob], file.name.replace(/\.\w+$/, '') + '-upscaled.png', { type: 'image/png' }),
      upscaled: true,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
