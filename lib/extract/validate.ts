import type { ErrorCode } from '../types'

/** Raised by the extraction pipeline for user-fixable input problems. */
export class InputError extends Error {
  code: ErrorCode
  hint?: string
  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message)
    this.name = 'InputError'
    this.code = code
    this.hint = hint
  }
}

const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
  {
    mime: 'image/jpeg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/webp',
    test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
]

/** Never trust the client's Content-Type — sniff the magic bytes. */
export function sniffMime(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.test(buffer)) return signature.mime
  }
  if (buffer.length > 4 && buffer.toString('ascii', 0, 4) === '%PDF') return 'application/pdf'
  if (buffer.length > 6 && (buffer.toString('ascii', 0, 3) === 'GIF')) return 'image/gif'
  if (buffer.length > 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp'
  return null
}

export interface ImageDimensions {
  width?: number
  height?: number
}

/**
 * Read width/height straight from the container headers (PNG IHDR, JPEG SOFn,
 * WebP VP8/VP8L/VP8X) — no decoder needed and no memory blow-up.
 */
export function readDimensions(buffer: Buffer, mime: string): ImageDimensions {
  try {
    if (mime === 'image/png' && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (mime === 'image/jpeg') {
      for (let i = 2; i < buffer.length - 9; i++) {
        if (buffer[i] !== 0xff) continue
        const marker = buffer[i + 1]
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
        }
        const segmentLength = buffer.readUInt16BE(i + 2)
        i += segmentLength + 1
      }
      return {}
    }
    if (mime === 'image/webp' && buffer.length > 30) {
      const fourcc = buffer.toString('ascii', 12, 16)
      if (fourcc === 'VP8 ' && buffer.length > 30) {
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff,
        }
      }
      if (fourcc === 'VP8L' && buffer.length > 25) {
        const bits = buffer.readUInt32LE(21)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
      if (fourcc === 'VP8X' && buffer.length > 30) {
        return {
          width: (buffer.readUIntLE(24, 3) + 1),
          height: (buffer.readUIntLE(27, 3) + 1),
        }
      }
    }
  } catch {
    // fall through — dimensions are best-effort
  }
  return {}
}

export const SUPPORTED_FORMAT_NOTE = 'PNG, JPG or WebP screenshots up to 10 MB.'

export function describeUnsupported(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'PDFs are not supported yet — export the page as an image, or screenshot the table instead.'
    case 'image/gif':
      return 'Animated GIFs are not supported. Save the frame you need as PNG.'
    case 'image/bmp':
      return 'BMP is not supported. Convert the image to PNG or JPG first.'
    default:
      return `We could not recognise that file as an image. ${SUPPORTED_FORMAT_NOTE}`
  }
}
