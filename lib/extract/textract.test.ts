import { describe, expect, it } from 'vitest'
import type { Block } from '@aws-sdk/client-textract'

import { parseTable } from './textract'

/** Minimal but faithful AnalyzeDocument(TABLES) block graph. */
function blocks(): Block[] {
  const geometry = (left: number, top: number) => ({
    BoundingBox: { Left: left, Top: top, Width: 0.2, Height: 0.05 },
    Page: 1,
  })
  const table: Block = {
    Id: 'table',
    BlockType: 'TABLE',
    Relationships: [{ Type: 'CHILD', Ids: ['c11', 'c12', 'c21', 'c22', 'c31', 'c32'] }],
  }
  const cells: Block[] = [
    {
      Id: 'c11',
      BlockType: 'CELL',
      RowIndex: 1,
      ColumnIndex: 1,
      Confidence: 99,
      Relationships: [{ Type: 'CHILD', Ids: ['w1'] }],
    },
    {
      Id: 'c12',
      BlockType: 'CELL',
      RowIndex: 1,
      ColumnIndex: 2,
      Confidence: 98,
      Relationships: [{ Type: 'CHILD', Ids: ['w2'] }],
    },
    {
      // vertically merged cell spanning rows 2-3
      Id: 'c21',
      BlockType: 'CELL',
      RowIndex: 2,
      ColumnIndex: 1,
      RowSpan: 2,
      Confidence: 95,
      Relationships: [{ Type: 'CHILD', Ids: ['w3'] }],
    },
    { Id: 'c22', BlockType: 'CELL', RowIndex: 2, ColumnIndex: 2, Confidence: 60, Relationships: [{ Type: 'CHILD', Ids: ['w4'] }] },
    { Id: 'c31', BlockType: 'CELL', RowIndex: 4, ColumnIndex: 1, Confidence: 97, Relationships: [{ Type: 'CHILD', Ids: [] }] },
    {
      Id: 'c32',
      BlockType: 'CELL',
      RowIndex: 3,
      ColumnIndex: 2,
      Confidence: 90,
      Relationships: [{ Type: 'CHILD', Ids: ['w5', 'sel'] }],
    },
  ]
  const words: Block[] = [
    { Id: 'w1', BlockType: 'WORD', Text: 'Region', Geometry: geometry(0.05, 0.1), Confidence: 99 },
    { Id: 'w2', BlockType: 'WORD', Text: 'Units', Geometry: geometry(0.4, 0.1), Confidence: 98 },
    { Id: 'w3', BlockType: 'WORD', Text: 'EMEA', Geometry: geometry(0.05, 0.2), Confidence: 95 },
    { Id: 'w4', BlockType: 'WORD', Text: '2,0l0', Geometry: geometry(0.4, 0.2), Confidence: 60 },
    { Id: 'w5', BlockType: 'WORD', Text: 'done', Geometry: geometry(0.4, 0.3), Confidence: 90 },
  ]
  const selection: Block = {
    Id: 'sel',
    BlockType: 'SELECTION_ELEMENT',
    SelectionStatus: 'SELECTED',
    Geometry: geometry(0.6, 0.3),
  }
  return [table, ...cells, ...words, selection]
}

describe('textract parser', () => {
  it('maps cells, spans and selection elements onto the table model', () => {
    const byId = new Map(blocks().map((block) => [block.Id as string, block]))
    const table = parseTable(byId.get('table') as Block, byId, 0, 1)
    expect(table).not.toBeNull()
    if (!table) return
    expect(table.rowCount).toBe(3)
    expect(table.colCount).toBe(2)
    expect(table.cells[0].map((cell) => cell.value)).toEqual(['Region', 'Units'])
    expect(table.cells[1][0].value).toBe('EMEA')
    expect(table.cells[1][0].rowSpan).toBe(2)
    expect(table.cells[2][0].covered).toBe(true)
    // selection elements become checkable text
    expect(table.cells[2][1].value).toBe('done [x]')
    expect(table.cells[1][1].confidence).toBe(0.6)
    expect(table.lowConfidenceCount).toBe(1)
  })
})
