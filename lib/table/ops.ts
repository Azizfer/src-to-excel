import type { ExtractedTable } from '../types'
import { clamp } from '../utils'
import { cloneTable, finalize, makeCell } from './model'

/**
 * Structural + value edits on the table model.
 * Every function is pure: it clones the input and returns a new table, which
 * makes undo/redo a one-liner in the UI.
 */

export function setCellValue(
  table: ExtractedTable,
  row: number,
  col: number,
  value: string,
  options: { markEdited?: boolean } = {},
): ExtractedTable {
  const next = cloneTable(table)
  const cell = next.cells[row]?.[col]
  if (!cell) return table
  if (cell.value === value) return table
  cell.value = value
  if (options.markEdited !== false) {
    cell.edited = true
    // A human-verified value is as good as confidence gets.
    cell.confidence = 1
  }
  return finalize(next)
}

export function clearCell(table: ExtractedTable, row: number, col: number): ExtractedTable {
  return setCellValue(table, row, col, '')
}

export function insertRow(
  table: ExtractedTable,
  at: number,
  position: 'before' | 'after' | 'end' = 'end',
): ExtractedTable {
  const next = cloneTable(table)
  const index =
    position === 'end' ? next.rowCount : position === 'after' ? clamp(at + 1, 0, next.rowCount) : clamp(at, 0, next.rowCount)

  // Merges that straddle the insertion point grow by one row so the new row
  // lands *inside* the merged region rather than splitting it.
  for (let r = 0; r < index; r++) {
    for (let c = 0; c < next.colCount; c++) {
      const cell = next.cells[r][c]
      if (cell && !cell.covered && r + cell.rowSpan > index) cell.rowSpan += 1
    }
  }

  next.cells.splice(index, 0, Array.from({ length: next.colCount }, () => makeCell()))
  next.rowCount = next.cells.length
  if (next.headerRowCount > 0 && index < next.headerRowCount) next.headerRowCount += 1
  return finalize(next)
}

export function deleteRow(table: ExtractedTable, row: number): ExtractedTable {
  if (table.rowCount <= 1) return table
  const next = cloneTable(table)
  const index = clamp(row, 0, next.rowCount - 1)

  // An anchor sitting in the deleted row but spanning further down moves down.
  for (let c = 0; c < next.colCount; c++) {
    const cell = next.cells[index][c]
    if (!cell || cell.covered) continue
    if (cell.rowSpan > 1 && index + 1 < next.rowCount) {
      next.cells[index + 1][c] = { ...cell, rowSpan: cell.rowSpan - 1 }
    }
  }
  // Anchors above the deleted row that reach past it shrink by one.
  for (let r = 0; r < index; r++) {
    for (let c = 0; c < next.colCount; c++) {
      const cell = next.cells[r][c]
      if (cell && !cell.covered && r + cell.rowSpan > index) cell.rowSpan -= 1
    }
  }

  next.cells.splice(index, 1)
  next.rowCount = next.cells.length
  next.headerRowCount = clamp(next.headerRowCount, 0, Math.min(1, next.rowCount))
  return finalize(next)
}

export function insertColumn(
  table: ExtractedTable,
  at: number,
  position: 'before' | 'after' | 'end' = 'end',
): ExtractedTable {
  const next = cloneTable(table)
  const index =
    position === 'end' ? next.colCount : position === 'after' ? clamp(at + 1, 0, next.colCount) : clamp(at, 0, next.colCount)

  for (let r = 0; r < next.rowCount; r++) {
    for (let c = 0; c < index; c++) {
      const cell = next.cells[r][c]
      if (cell && !cell.covered && c + cell.colSpan > index) cell.colSpan += 1
    }
    next.cells[r].splice(index, 0, makeCell())
  }
  next.colCount = next.cells[0]?.length ?? 0
  return finalize(next)
}

export function deleteColumn(table: ExtractedTable, col: number): ExtractedTable {
  if (table.colCount <= 1) return table
  const next = cloneTable(table)
  const index = clamp(col, 0, next.colCount - 1)

  for (let r = 0; r < next.rowCount; r++) {
    const cell = next.cells[r][index]
    if (cell && !cell.covered && cell.colSpan > 1 && index + 1 < next.colCount) {
      next.cells[r][index + 1] = { ...cell, colSpan: cell.colSpan - 1 }
    }
    for (let c = 0; c < index; c++) {
      const left = next.cells[r][c]
      if (left && !left.covered && c + left.colSpan > index) left.colSpan -= 1
    }
    next.cells[r].splice(index, 1)
  }
  next.colCount = next.cells[0]?.length ?? 0
  return finalize(next)
}

/** Turn every merged region into independent cells (keeps the anchor's text). */
export function flattenMerges(table: ExtractedTable): ExtractedTable {
  const next = cloneTable(table)
  for (const row of next.cells) {
    for (const cell of row) {
      cell.rowSpan = 1
      cell.colSpan = 1
      cell.covered = false
    }
  }
  return finalize(next)
}

/** Merge a rectangular selection into one cell, folding the text together. */
export function mergeRegion(
  table: ExtractedTable,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): ExtractedTable {
  const r0 = clamp(Math.min(startRow, endRow), 0, table.rowCount - 1)
  const r1 = clamp(Math.max(startRow, endRow), 0, table.rowCount - 1)
  const c0 = clamp(Math.min(startCol, endCol), 0, table.colCount - 1)
  const c1 = clamp(Math.max(startCol, endCol), 0, table.colCount - 1)
  if (r0 === r1 && c0 === c1) return table

  const next = flattenMerges(table)
  const parts: string[] = []
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const value = next.cells[r][c].value.trim()
      if (value) parts.push(value)
    }
  }
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      next.cells[r][c] = makeCell('')
    }
  }
  next.cells[r0][c0] = makeCell(parts.join(' '), { rowSpan: r1 - r0 + 1, colSpan: c1 - c0 + 1 })
  return finalize(next)
}

export function unmergeCell(table: ExtractedTable, row: number, col: number): ExtractedTable {
  const cell = table.cells[row]?.[col]
  if (!cell || (cell.rowSpan === 1 && cell.colSpan === 1)) return table
  const next = cloneTable(table)
  next.cells[row][col].rowSpan = 1
  next.cells[row][col].colSpan = 1
  return finalize(next)
}

export function setHeaderRowCount(table: ExtractedTable, headerRowCount: number): ExtractedTable {
  const next = cloneTable(table)
  next.headerRowCount = clamp(headerRowCount, 0, Math.min(1, next.rowCount))
  return finalize(next)
}

/**
 * Paste a TSV/CSV blob (clipboard or a multi-cell paste) starting at a cell.
 * Grows the table when the pasted block overflows the current dimensions.
 */
export function pasteBlock(table: ExtractedTable, row: number, col: number, text: string): ExtractedTable {
  const delimiter = detectDelimiter(text)
  const rows = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => splitDelimitedRow(line, delimiter))
  if (!rows.length) return table

  let next = flattenMerges(table)
  const neededRows = row + rows.length
  const neededCols = col + Math.max(...rows.map((r) => r.length))
  while (next.rowCount < neededRows) next = insertRow(next, next.rowCount, 'end')
  while (next.colCount < neededCols) next = insertColumn(next, next.colCount, 'end')

  rows.forEach((values, r) => {
    values.forEach((value, c) => {
      const cell = next.cells[row + r]?.[col + c]
      if (!cell) return
      cell.value = value
      cell.edited = true
      cell.confidence = 1
    })
  })
  return finalize(next)
}

/**
 * Clipboard payloads from spreadsheets are usually TSV, but CSV shows up too.
 * Tabs win when both are present — commas inside numbers/dates are common,
 * tabs inside cell values are not.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  if (firstLine.includes('\t')) return '\t'
  if (firstLine.includes(';') && !firstLine.includes(',')) return ';'
  return ','
}

/** Minimal RFC 4180 row splitter — handles quoted fields containing delimiters. */
export function splitDelimitedRow(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (line.startsWith(delimiter, i)) {
      fields.push(current)
      current = ''
      i += delimiter.length - 1
      continue
    }
    current += char
  }
  fields.push(current)
  return fields
}
