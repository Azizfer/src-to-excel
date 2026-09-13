import type { ExtractedTable, ExportFormat } from '../types'
import { safeFileName } from '../utils'
import { toMatrix, toMergeRegions } from './model'

/**
 * Export lives entirely in the browser: the edited table never goes back to a
 * server, and SheetJS is loaded on demand so it stays out of the initial bundle.
 */

export interface ExportOptions {
  sheetName?: string
  /** Convert clean numeric strings into real numbers so Excel can sum them. */
  smartNumbers?: boolean
  /** Prepend a UTF-8 BOM so Excel opens CSV files with accents correctly. */
  csvBom?: boolean
}

const NUMERIC = /^-?\d+(\.\d+)?$/
const GROUPED_NUMERIC = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/

/** `1,240.50` -> 1240.5, but `007` and `12%` stay text (leading zeros carry meaning). */
export function coerceNumber(value: string): string | number {
  const trimmed = value.trim()
  if (!trimmed) return value
  if (/^0\d/.test(trimmed)) return value
  if (NUMERIC.test(trimmed)) return Number(trimmed)
  if (GROUPED_NUMERIC.test(trimmed)) return Number(trimmed.replace(/,/g, ''))
  return value
}

export function exportMatrix(table: ExtractedTable, options: ExportOptions = {}): (string | number)[][] {
  const matrix = toMatrix(table)
  if (!options.smartNumbers) return matrix
  return matrix.map((row) => row.map((value) => coerceNumber(value)))
}

function quoteCsvField(value: string | number): string {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function tableToCsv(table: ExtractedTable, options: ExportOptions = {}): string {
  const rows = exportMatrix(table, options).map((row) => row.map(quoteCsvField).join(','))
  return (options.csvBom === false ? '' : '\uFEFF') + rows.join('\r\n')
}

export function tableToTsv(table: ExtractedTable): string {
  return toMatrix(table)
    .map((row) => row.map((value) => value.replace(/[\t\n\r]+/g, ' ')).join('\t'))
    .join('\n')
}

export function tableToJson(table: ExtractedTable): string {
  const matrix = toMatrix(table)
  const header = table.headerRowCount > 0 ? matrix[0] : null
  const body = header ? matrix.slice(1) : matrix
  const records = header
    ? body.map((row) => Object.fromEntries(header.map((key, index) => [key || `column_${index + 1}`, row[index] ?? ''])))
    : body
  return JSON.stringify(
    {
      name: table.name,
      rowCount: table.rowCount,
      colCount: table.colCount,
      header,
      rows: matrix,
      records,
      merges: toMergeRegions(table),
      stats: {
        provider: table.provider,
        averageConfidence: table.averageConfidence ?? null,
        lowConfidenceCells: table.lowConfidenceCount,
        editedCells: table.editedCount,
      },
    },
    null,
    2,
  )
}

function columnWidths(table: ExtractedTable): { wch: number }[] {
  const matrix = toMatrix(table)
  return Array.from({ length: table.colCount }, (_, col) => {
    const longest = matrix.reduce((max, row) => Math.max(max, (row[col] ?? '').length), 8)
    return { wch: Math.min(48, longest + 2) }
  })
}

export async function tableToXlsxBlob(table: ExtractedTable, options: ExportOptions = {}): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(exportMatrix(table, options))
  const merges = toMergeRegions(table)
  if (merges.length) {
    sheet['!merges'] = merges.map((region) => ({
      s: { r: region.row, c: region.col },
      e: { r: region.row + region.rowSpan - 1, c: region.col + region.colSpan - 1 },
    }))
  }
  sheet['!cols'] = columnWidths(table)

  const workbook = XLSX.utils.book_new()
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  const rawName = (options.sheetName || table.name || 'Sheet1').slice(0, 31)
  XLSX.utils.book_append_sheet(workbook, sheet, rawName.replace(/[:\\/?*[\]]/g, '') || 'Sheet1')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function downloadTable(
  table: ExtractedTable,
  format: ExportFormat,
  fileName: string,
  options: ExportOptions = {},
): Promise<{ fileName: string; bytes: number }> {
  const base = safeFileName(fileName, 'table')
  if (format === 'xlsx') {
    const blob = await tableToXlsxBlob(table, options)
    const name = `${base}.xlsx`
    downloadBlob(blob, name)
    return { fileName: name, bytes: blob.size }
  }
  if (format === 'csv') {
    const csv = tableToCsv(table, options)
    const blob = new Blob([csv], { type: EXPORT_MIME.csv })
    const name = `${base}.csv`
    downloadBlob(blob, name)
    return { fileName: name, bytes: blob.size }
  }
  const json = tableToJson(table)
  const blob = new Blob([json], { type: EXPORT_MIME.json })
  const name = `${base}.json`
  downloadBlob(blob, name)
  return { fileName: name, bytes: blob.size }
}

export async function copyTableToClipboard(table: ExtractedTable): Promise<void> {
  const tsv = tableToTsv(table)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(tsv)
    return
  }
  // Fallback for older browsers / insecure contexts.
  const area = document.createElement('textarea')
  area.value = tsv
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}
