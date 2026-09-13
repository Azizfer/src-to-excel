import type { ExtractedTable, TableCell } from '../types'
import { LOW_CONFIDENCE_THRESHOLD } from '../constants'
import { finalize, makeCell, trimEmptyEdges } from '../table/model'

/**
 * Turns flat OCR word/line geometry into a table model.
 *
 * Strategy (works for bordered *and* borderless tables):
 *  1. group words into rows by vertical centre
 *  2. find column separators as x-ranges that no word ever covers ("gaps"),
 *     keeping only gaps that actually split many rows — otherwise ordinary
 *     word spacing inside a cell would look like a column boundary
 *  3. detect merged cells: an OCR line that crosses several detected columns
 *     while the rest of the row stays empty is a spanning cell
 */

export interface OcrBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrWord {
  text: string
  /** 0..100 */
  confidence: number
  bbox: OcrBox
}

export interface OcrLine {
  text: string
  bbox: OcrBox
  words: OcrWord[]
}

export interface OcrPage {
  width: number
  height: number
  lines: OcrLine[]
}

interface RowGroup {
  centerY: number
  words: OcrWord[]
  lines: OcrLine[]
}

const xCenter = (box: OcrBox) => (box.x0 + box.x1) / 2
const yCenter = (box: OcrBox) => (box.y0 + box.y1) / 2

export function groupWordsIntoRows(words: OcrWord[]): RowGroup[] {
  const heights = words.map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b)
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 16
  const tolerance = Math.max(4, medianHeight * 0.6)

  const sorted = [...words].sort((a, b) => yCenter(a.bbox) - yCenter(b.bbox))
  const rows: RowGroup[] = []
  for (const word of sorted) {
    const center = yCenter(word.bbox)
    const row = rows[rows.length - 1]
    if (row && Math.abs(center - row.centerY) <= tolerance) {
      const total = row.words.length
      row.centerY = (row.centerY * total + center) / (total + 1)
      row.words.push(word)
    } else {
      rows.push({ centerY: center, words: [word], lines: [] })
    }
  }
  for (const row of rows) row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0)
  return rows
}

/** Attach each OCR line to the row group its centre falls into (for merge detection). */
function attachLines(rows: RowGroup[], lines: OcrLine[]): void {
  for (const line of lines) {
    if (!line.words.length) continue
    const center = yCenter(line.bbox)
    let best: RowGroup | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const row of rows) {
      const distance = Math.abs(center - row.centerY)
      if (distance < bestDistance) {
        bestDistance = distance
        best = row
      }
    }
    if (best) best.lines.push(line)
  }
}

/** Gap intervals between consecutive words of a row. */
function rowGaps(row: RowGroup, minGap: number): { from: number; to: number }[] {
  const gaps: { from: number; to: number }[] = []
  const sorted = row.words
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i].bbox.x1
    const to = sorted[i + 1].bbox.x0
    if (to - from >= minGap) gaps.push({ from, to })
  }
  return gaps
}

export function detectColumnBoundaries(rows: RowGroup[], pageWidth: number): number[] {
  if (!rows.length || pageWidth <= 0) return []

  const heights = rows.flatMap((row) => row.words.map((word) => word.bbox.y1 - word.bbox.y0))
  const medianHeight = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 16
  // A space inside a cell is ~0.5-0.65x the word height in real screenshots,
  // while column separators are wider. Scaling by text height (not page width)
  // keeps this resolution-free.
  const minGap = Math.max(6, medianHeight * 0.75)
  const minSupport = Math.max(2, Math.ceil(rows.length * 0.5))

  interface Cluster {
    from: number
    to: number
    support: number
    width: number
  }
  const clusters: Cluster[] = []
  for (const row of rows) {
    for (const gap of rowGaps(row, minGap)) {
      // Join the cluster whose *shared* interval this gap still overlaps, so
      // bolder/wider header text shifting a gap by a few px stays in the vote.
      const cluster = clusters.find((entry) => gap.from <= entry.to && gap.to >= entry.from)
      if (cluster) {
        cluster.from = Math.max(cluster.from, gap.from)
        cluster.to = Math.min(cluster.to, gap.to)
        cluster.support += 1
        cluster.width = Math.max(cluster.width, gap.to - gap.from)
      } else {
        clusters.push({ from: gap.from, to: gap.to, support: 1, width: gap.to - gap.from })
      }
    }
  }

  const minSpacing = Math.max(8, medianHeight * 0.9)
  const kept = clusters
    .filter((cluster) => cluster.support >= minSupport && cluster.to >= cluster.from)
    .sort((a, b) => b.width * b.support - a.width * a.support)

  const boundaries: number[] = []
  for (const cluster of kept) {
    const center = (cluster.from + cluster.to) / 2
    if (boundaries.every((existing) => Math.abs(existing - center) > minSpacing)) {
      boundaries.push(center)
    }
  }
  return boundaries.sort((a, b) => a - b)
}

/** Fallback when the table is so dense that no clean x-gap survives. */
export function boundariesFromWordStarts(rows: RowGroup[], pageWidth: number): number[] {
  const starts = rows.flatMap((row) => row.words.map((word) => word.bbox.x0)).sort((a, b) => a - b)
  if (!starts.length) return []
  const heights = rows.flatMap((row) => row.words.map((word) => word.bbox.y1 - word.bbox.y0))
  const medianHeight = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 16
  const tolerance = medianHeight * 0.75

  const clusters: { center: number; count: number }[] = []
  for (const start of starts) {
    const cluster = clusters[clusters.length - 1]
    if (cluster && Math.abs(start - cluster.center) <= tolerance) {
      cluster.center = (cluster.center * cluster.count + start) / (cluster.count + 1)
      cluster.count++
    } else {
      clusters.push({ center: start, count: 1 })
    }
  }
  const significant = clusters.filter((cluster) => cluster.count >= Math.max(2, rows.length * 0.4))
  const boundaries: number[] = []
  for (const cluster of significant.slice(1)) {
    boundaries.push(cluster.center - tolerance / 2)
  }
  return boundaries.filter((boundary) => boundary > 0 && boundary < pageWidth)
}

export interface StructureOptions {
  id?: string
  name?: string
  provider?: ExtractedTable['provider']
}

/**
 * A row is "aligned" when the gaps between its words sit on the global column
 * separators. Rows that fail this (titles, banners, totals that float across
 * columns) are emitted as full-width merged rows instead of being allowed to
 * pollute column detection.
 */
export function isAlignedRow(row: RowGroup, boundaries: number[], minGap = 4): boolean {
  const sorted = row.words
  if (sorted.length < 2) return true
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const within = boundaries.filter((boundary) => boundary > first.bbox.x1 - 1 && boundary < last.bbox.x0 + 1)
  if (!within.length) return true
  const gaps = rowGaps(row, 0)
  let coinciding = 0
  for (const boundary of within) {
    if (gaps.some((gap) => gap.from - 1 <= boundary && gap.to + 1 >= boundary)) coinciding++
  }
  void minGap
  return coinciding / within.length >= 0.6
}

export function buildTableFromOcr(page: OcrPage, options: StructureOptions = {}): ExtractedTable | null {
  const words = page.lines
    .flatMap((line) => line.words)
    .filter((word) => word.text.trim().length > 0 && word.confidence >= 0)

  if (words.length < 4) return null

  const rows = groupWordsIntoRows(words)
  if (rows.length < 2) return null
  attachLines(rows, page.lines)

  let boundaries = detectColumnBoundaries(rows, page.width)
  if (boundaries.length < 1) boundaries = boundariesFromWordStarts(rows, page.width)
  if (boundaries.length < 1) return null

  // Spanning rows (titles etc.) are excluded, then columns are re-detected
  // from the aligned rows only.
  const spanning = new Set<RowGroup>()
  for (const row of rows) {
    if (!isAlignedRow(row, boundaries)) spanning.add(row)
  }
  if (spanning.size && rows.length - spanning.size >= 2) {
    const refined = detectColumnBoundaries(
      rows.filter((row) => !spanning.has(row)),
      page.width,
    )
    if (refined.length) boundaries = refined
  }

  const colCount = boundaries.length + 1
  const columnOf = (x: number): number => {
    let index = 0
    while (index < boundaries.length && x > boundaries[index]) index++
    return index
  }

  interface OutputRow {
    spanning: boolean
    cells: TableCell[]
    confidences: (number[] | undefined)[]
  }

  const outputRows: OutputRow[] = rows.map((row) => {
    if (spanning.has(row)) {
      const anchor = makeCell(row.lines.map((line) => line.text.trim()).filter(Boolean).join(' ').trim())
      const cells = Array.from({ length: colCount }, (_, index) => (index === 0 ? anchor : makeCell()))
      cells[0].colSpan = colCount
      const conf = row.words.map((word) => word.confidence / 100)
      const confidences: (number[] | undefined)[] = Array.from({ length: colCount }, (_, index) =>
        index === 0 ? conf : [],
      )
      return { spanning: true, cells, confidences }
    }

    const cells: TableCell[] = Array.from({ length: colCount }, () => makeCell())
    const confidences: (number[] | undefined)[] = Array.from({ length: colCount }, () => undefined)
    for (const word of row.words) {
      const column = columnOf(xCenter(word.bbox))
      const cell = cells[column]
      cell.value = cell.value ? `${cell.value} ${word.text}` : word.text
      ;(confidences[column] ??= []).push(word.confidence / 100)
    }
    return { spanning: false, cells, confidences }
  })

  const table: ExtractedTable = {
    id: options.id ?? `table-${Date.now().toString(36)}`,
    name: options.name ?? 'Detected table',
    rowCount: outputRows.length,
    colCount,
    cells: outputRows.map((output) =>
      output.cells.map((cell, colIndex) => {
        const conf = output.confidences[colIndex]
        const measured = conf && conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : undefined
        const next = { ...cell }
        if (measured !== undefined) next.confidence = Math.round(measured * 1000) / 1000
        return next
      }),
    ),
    headerRowCount: 0,
    lowConfidenceCount: 0,
    editedCount: 0,
    provider: options.provider ?? 'local',
  }

  const trimmed = trimEmptyEdges(table)
  if (trimmed.rowCount < 2 || trimmed.colCount < 2) return null
  trimmed.headerRowCount = guessHeaderRow(trimmed) ? 1 : 0
  return finalize(trimmed)
}

function guessHeaderRow(table: ExtractedTable): boolean {
  if (table.rowCount < 3) return false
  const first = table.cells[0]
  const anchorCells = first.filter((cell) => !cell.covered)
  if (anchorCells.length === 1 && anchorCells[0].colSpan >= table.colCount) return false
  return anchorCells.every((cell) => cell.value.trim().length > 0)
}

export function countLowConfidence(table: ExtractedTable): number {
  let count = 0
  for (const row of table.cells) {
    for (const cell of row) {
      if (!cell.covered && typeof cell.confidence === 'number' && cell.confidence < LOW_CONFIDENCE_THRESHOLD) count++
    }
  }
  return count
}
