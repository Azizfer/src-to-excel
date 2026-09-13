/**
 * Shared types for the extraction pipeline and the editable grid.
 *
 * The table model is a *dense* matrix (`rowCount` x `colCount`) where merged
 * regions are expressed by an anchor cell carrying `rowSpan`/`colSpan` and the
 * slots it hides carrying `covered: true`. A dense matrix keeps editing,
 * exporting and keyboard navigation simple while still round-tripping the
 * merged cells that document-AI services report.
 */

export const PROVIDERS = ['textract', 'local', 'sample'] as const
export type ProviderId = (typeof PROVIDERS)[number]

export interface TableCell {
  value: string
  /** OCR confidence 0..1. `undefined` means "not measured" (e.g. typed by hand). */
  confidence?: number
  rowSpan: number
  colSpan: number
  /** True when this slot is hidden underneath another cell's span. */
  covered?: boolean
  /** True once a human has edited the value. Used for the accuracy metric. */
  edited?: boolean
}

export interface ExtractedTable {
  id: string
  name: string
  rowCount: number
  colCount: number
  cells: TableCell[][]
  /** 0 or 1 — how many leading rows are treated as headers. */
  headerRowCount: number
  /** Mean OCR confidence across measured cells, 0..1. */
  averageConfidence?: number
  lowConfidenceCount: number
  provider: ProviderId
  /** Cells a human has corrected — feeds the "% of cells edited" accuracy proxy. */
  editedCount: number
}

export interface ImageMeta {
  bytes: number
  mime: string
  width?: number
  height?: number
}

export interface UsageInfo {
  used: number
  limit: number
  remaining: number
  /** ISO timestamp of the next daily reset (UTC midnight). */
  resetAt: string
  limited: boolean
}

export type ErrorCode =
  | 'bad_request'
  | 'unsupported_type'
  | 'too_large'
  | 'invalid_image'
  | 'no_table'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_error'

export interface ExtractSuccess {
  ok: true
  provider: ProviderId
  tables: ExtractedTable[]
  image: ImageMeta
  usage: UsageInfo
  timingMs: number
  warnings: string[]
}

export interface ExtractFailure {
  ok: false
  error: { code: ErrorCode; message: string; hint?: string }
  usage?: UsageInfo
}

export type ExtractResponse = ExtractSuccess | ExtractFailure

export type ExportFormat = 'xlsx' | 'csv' | 'json'
