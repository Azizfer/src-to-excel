import type { ExtractedTable, ProviderId, TableCell } from '../types'
import { clamp } from '../utils'

export function makeCell(value = '', init: Partial<TableCell> = {}): TableCell {
  return {
    value,
    confidence: init.confidence,
    rowSpan: Math.max(1, init.rowSpan ?? 1),
    colSpan: Math.max(1, init.colSpan ?? 1),
    covered: init.covered ?? false,
    edited: init.edited ?? false,
  }
}

export function createEmptyTable(
  rowCount: number,
  colCount: number,
  init: { name?: string; provider?: ProviderId; headerRowCount?: number } = {},
): ExtractedTable {
  const rows = Math.max(1, Math.floor(rowCount))
  const cols = Math.max(1, Math.floor(colCount))
  const cells: TableCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell()),
  )
  return finalize({
    id: init.name ? slugId(init.name) : `table-${rows}x${cols}-${Date.now().toString(36)}`,
    name: init.name ?? 'Table',
    rowCount: rows,
    colCount: cols,
    cells,
    headerRowCount: init.headerRowCount ?? 0,
    lowConfidenceCount: 0,
    editedCount: 0,
    provider: init.provider ?? 'sample',
  })
}

function slugId(name: string): string {
  return `table-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'x'}`
}

export function cloneTable(table: ExtractedTable): ExtractedTable {
  return {
    ...table,
    cells: table.cells.map((row) => row.map((cell) => ({ ...cell }))),
  }
}

/**
 * Recompute every `covered` flag from the anchors' spans. Call this after any
 * structural edit so the matrix and the spans can never disagree.
 */
export function rebuildCoverage(table: ExtractedTable): ExtractedTable {
  for (const row of table.cells) for (const cell of row) cell.covered = false

  for (let r = 0; r < table.rowCount; r++) {
    for (let c = 0; c < table.colCount; c++) {
      const anchor = table.cells[r]?.[c]
      if (!anchor || anchor.covered) continue
      const rowSpan = clamp(anchor.rowSpan, 1, table.rowCount - r)
      const colSpan = clamp(anchor.colSpan, 1, table.colCount - c)
      anchor.rowSpan = rowSpan
      anchor.colSpan = colSpan
      if (rowSpan === 1 && colSpan === 1) continue
      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          if (rr === r && cc === c) continue
          const covered = table.cells[rr]?.[cc]
          if (!covered) continue
          covered.covered = true
          covered.rowSpan = 1
          covered.colSpan = 1
          // Content that ends up hidden under a merge would be silently lost on
          // export, so fold it into the anchor instead.
          if (covered.value.trim()) {
            anchor.value = anchor.value.trim()
              ? `${anchor.value.trim()} ${covered.value.trim()}`
              : covered.value.trim()
            covered.value = ''
          }
        }
      }
    }
  }
  return table
}

export function recomputeStats(table: ExtractedTable): ExtractedTable {
  let total = 0
  let sum = 0
  let low = 0
  let edited = 0
  for (const row of table.cells) {
    for (const cell of row) {
      if (cell.covered) continue
      if (cell.edited) edited++
      if (typeof cell.confidence === 'number') {
        total++
        sum += cell.confidence
        if (cell.confidence < 0.75) low++
      }
    }
  }
  table.averageConfidence = total ? sum / total : undefined
  table.lowConfidenceCount = low
  table.editedCount = edited
  return table
}

/** Coverage flags + spans + stats, in the right order. Always safe to call. */
export function finalize(table: ExtractedTable): ExtractedTable {
  return recomputeStats(rebuildCoverage(table))
}

/**
 * For every slot, the coordinates of the anchor cell that owns it.
 * Powers keyboard navigation over merged regions.
 */
export function anchorMap(table: ExtractedTable): [number, number][][] {
  const map: [number, number][][] = Array.from({ length: table.rowCount }, (_, r) =>
    Array.from({ length: table.colCount }, (_, c) => [r, c] as [number, number]),
  )
  for (let r = 0; r < table.rowCount; r++) {
    for (let c = 0; c < table.colCount; c++) {
      const anchor = table.cells[r][c]
      if (!anchor || anchor.covered) continue
      for (let rr = r; rr < Math.min(table.rowCount, r + anchor.rowSpan); rr++) {
        for (let cc = c; cc < Math.min(table.colCount, c + anchor.colSpan); cc++) {
          map[rr][cc] = [r, c]
        }
      }
    }
  }
  return map
}

/** Flatten the model into a plain string matrix (what a CSV looks like). */
export function toMatrix(table: ExtractedTable): string[][] {
  return Array.from({ length: table.rowCount }, (_, r) =>
    Array.from({ length: table.colCount }, (_, c) => table.cells[r][c]?.value ?? ''),
  )
}

export interface MergeRegion {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

/** Merge regions in SheetJS' `!merges` shape (0-based inclusive ranges). */
export function toMergeRegions(table: ExtractedTable): MergeRegion[] {
  const regions: MergeRegion[] = []
  for (let r = 0; r < table.rowCount; r++) {
    for (let c = 0; c < table.colCount; c++) {
      const cell = table.cells[r][c]
      if (!cell || cell.covered) continue
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        regions.push({ row: r, col: c, rowSpan: cell.rowSpan, colSpan: cell.colSpan })
      }
    }
  }
  return regions
}

export function tableDimensions(table: ExtractedTable): { rows: number; cols: number } {
  return { rows: table.rowCount, cols: table.colCount }
}

/** Drop fully empty rows/columns at the edges (OCR often leaves a blank frame). */
export function trimEmptyEdges(table: ExtractedTable): ExtractedTable {
  const next = cloneTable(table)
  const rowIsEmpty = (r: number) => next.cells[r].every((cell) => !cell.value.trim())
  const colIsEmpty = (c: number) => next.cells.every((row) => !row[c]?.value.trim())

  let start = 0
  while (start < next.rowCount - 1 && rowIsEmpty(start)) start++
  let end = next.rowCount - 1
  while (end > start && rowIsEmpty(end)) end--
  next.cells = next.cells.slice(start, end + 1)

  let colStart = 0
  while (colStart < next.colCount - 1 && colIsEmpty(colStart)) colStart++
  let colEnd = next.colCount - 1
  while (colEnd > colStart && colIsEmpty(colEnd)) colEnd--
  next.cells = next.cells.map((row) => row.slice(colStart, colEnd + 1))

  next.rowCount = next.cells.length
  next.colCount = next.cells[0]?.length ?? 0
  return finalize(next)
}
