import type { ProviderId } from './types'

/** Cells below this OCR confidence get flagged for review in the grid. */
export const LOW_CONFIDENCE_THRESHOLD = 0.75

/** Upload cap. Mirrors AWS Textract's synchronous AnalyzeDocument limit (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const FREE_DAILY_LIMIT = 5

/** Name of the anonymous usage cookie. */
export const USAGE_COOKIE = 's2x_id'

/** Images smaller than this on the long edge usually OCR badly. */
export const MIN_RECOMMENDED_DIMENSION = 480

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  textract: 'AWS Textract',
  local: 'On-server OCR',
  sample: 'Sample data',
}

export const PROVIDER_BLURBS: Record<ProviderId, string> = {
  textract: 'Purpose-built table extraction. Your image is analysed in memory and discarded.',
  local: 'Bundled OCR engine running on our server. Your image never reaches a third party.',
  sample: 'No image was processed — this is bundled example data.',
}
