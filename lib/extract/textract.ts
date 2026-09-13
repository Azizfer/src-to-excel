import { AnalyzeDocumentCommand, TextractClient, type Block } from '@aws-sdk/client-textract'

import type { ExtractedTable, TableCell } from '../types'
import { finalize, makeCell, trimEmptyEdges } from '../table/model'

/**
 * AWS Textract adapter — the production-grade provider from the product plan.
 * `AnalyzeDocument` with the TABLES feature returns rows/columns/cells with
 * confidence scores and merge spans, which map 1:1 onto our table model.
 *
 * Images are passed as in-memory `Bytes`; nothing is written to S3 or disk.
 */

let client: TextractClient | null = null

function getClient(region: string): TextractClient {
  if (!client) {
    client = new TextractClient({ region })
  }
  return client
}

export interface TextractExtraction {
  tables: ExtractedTable[]
  warnings: string[]
}

export async function extractWithTextract(
  buffer: Buffer,
  config: { region: string },
): Promise<TextractExtraction> {
  const response = await getClient(config.region).send(
    new AnalyzeDocumentCommand({
      Document: { Bytes: new Uint8Array(buffer) },
      FeatureTypes: ['TABLES'],
    }),
  )

  const blocks = response.Blocks ?? []
  const byId = new Map(blocks.filter((block) => block.Id).map((block) => [block.Id as string, block]))

  const tableBlocks = blocks
    .filter((block) => block.BlockType === 'TABLE')
    .sort((a, b) => (a.Geometry?.BoundingBox?.Top ?? 0) - (b.Geometry?.BoundingBox?.Top ?? 0))

  const tables = tableBlocks
    .map((tableBlock, index) => parseTable(tableBlock, byId, index, tableBlocks.length))
    .filter((table): table is ExtractedTable => table !== null)

  const warnings: string[] = []
  const lowConf = tables.reduce((sum, table) => sum + table.lowConfidenceCount, 0)
  if (lowConf > 0) {
    warnings.push(`${lowConf} cell${lowConf === 1 ? '' : 's'} came back with low confidence and ${lowConf === 1 ? 'is' : 'are'} highlighted for review.`)
  }

  return { tables, warnings }
}

export function parseTable(
  tableBlock: Block,
  byId: Map<string, Block>,
  index: number,
  totalTables: number,
): ExtractedTable | null {
  const cellIds =
    tableBlock.Relationships?.find((relation) => relation.Type === 'CHILD')?.Ids ?? []
  const cellBlocks = cellIds
    .map((id) => byId.get(id))
    .filter((block): block is Block => block?.BlockType === 'CELL')

  if (!cellBlocks.length) return null

  let rowCount = 0
  let colCount = 0
  for (const cell of cellBlocks) {
    rowCount = Math.max(rowCount, (cell.RowIndex ?? 1) + (cell.RowSpan ?? 1) - 1)
    colCount = Math.max(colCount, (cell.ColumnIndex ?? 1) + (cell.ColumnSpan ?? 1) - 1)
  }
  if (rowCount < 1 || colCount < 1) return null

  const cells: TableCell[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => makeCell()),
  )

  for (const cell of cellBlocks) {
    const row = (cell.RowIndex ?? 1) - 1
    const col = (cell.ColumnIndex ?? 1) - 1
    if (row < 0 || col < 0 || row >= rowCount || col >= colCount) continue

    const children = (cell.Relationships?.find((relation) => relation.Type === 'CHILD')?.Ids ?? [])
      .map((id) => byId.get(id))
      .filter((block): block is Block => Boolean(block))

    const words = children
      .filter((block) => block.BlockType === 'WORD')
      .sort((a, b) => {
        const topDelta = (a.Geometry?.BoundingBox?.Top ?? 0) - (b.Geometry?.BoundingBox?.Top ?? 0)
        if (Math.abs(topDelta) > 0.01) return topDelta
        return (a.Geometry?.BoundingBox?.Left ?? 0) - (b.Geometry?.BoundingBox?.Left ?? 0)
      })

    const selections = children.filter((block) => block.BlockType === 'SELECTION_ELEMENT')
    const selectionText = selections
      .map((selection) => (selection.SelectionStatus === 'SELECTED' ? '[x]' : '[ ]'))
      .join(' ')

    const value = [words.map((word) => word.Text ?? '').join(' '), selectionText]
      .filter(Boolean)
      .join(' ')
      .trim()

    const wordConfidences = words
      .map((word) => word.Confidence)
      .filter((confidence): confidence is number => typeof confidence === 'number')
    const confidence =
      typeof cell.Confidence === 'number'
        ? cell.Confidence / 100
        : wordConfidences.length
          ? wordConfidences.reduce((sum, value2) => sum + value2, 0) / wordConfidences.length / 100
          : undefined

    cells[row][col] = makeCell(value, {
      confidence: confidence === undefined ? undefined : Math.round(confidence * 1000) / 1000,
      rowSpan: Math.max(1, cell.RowSpan ?? 1),
      colSpan: Math.max(1, cell.ColumnSpan ?? 1),
    })
  }

  const table: ExtractedTable = {
    id: `textract-table-${index + 1}`,
    name: totalTables > 1 ? `Table ${index + 1}` : 'Detected table',
    rowCount,
    colCount,
    cells,
    headerRowCount: 0,
    lowConfidenceCount: 0,
    editedCount: 0,
    provider: 'textract',
  }

  const trimmed = trimEmptyEdges(table)
  trimmed.headerRowCount = looksLikeHeader(trimmed) ? 1 : 0
  return finalize(trimmed)
}

function looksLikeHeader(table: ExtractedTable): boolean {
  if (table.rowCount < 3) return false
  const anchors = table.cells[0].filter((cell) => !cell.covered)
  if (anchors.length === 1 && anchors[0].colSpan >= table.colCount) return false
  return anchors.every((cell) => cell.value.trim().length > 0)
}
