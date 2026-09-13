import { describe, expect, it } from 'vitest'

import { createEmptyTable, finalize, makeCell, toMatrix } from './model'
import {
  deleteColumn,
  deleteRow,
  detectDelimiter,
  flattenMerges,
  insertColumn,
  insertRow,
  mergeRegion,
  pasteBlock,
  setCellValue,
  splitDelimitedRow,
  unmergeCell,
} from './ops'

function grid(): ReturnType<typeof createEmptyTable> {
  const table = createEmptyTable(3, 3, { name: 'test' })
  const values = [
    ['a1', 'b1', 'c1'],
    ['a2', 'b2', 'c2'],
    ['a3', 'b3', 'c3'],
  ]
  table.cells = values.map((row) => row.map((value) => makeCell(value)))
  return finalize(table)
}

describe('table edits', () => {
  it('sets a value and marks the cell edited', () => {
    const next = setCellValue(grid(), 1, 1, 'hello')
    expect(next.cells[1][1].value).toBe('hello')
    expect(next.cells[1][1].edited).toBe(true)
    expect(next.editedCount).toBe(1)
  })

  it('inserts and deletes rows while keeping values aligned', () => {
    const inserted = insertRow(grid(), 1, 'before')
    expect(inserted.rowCount).toBe(4)
    expect(inserted.cells[1].every((cell) => cell.value === '')).toBe(true)
    expect(inserted.cells[2][0].value).toBe('a2')

    const deleted = deleteRow(inserted, 1)
    expect(toMatrix(deleted)).toEqual(toMatrix(grid()))
  })

  it('inserts and deletes columns', () => {
    const inserted = insertColumn(grid(), 0, 'after')
    expect(inserted.colCount).toBe(4)
    expect(inserted.cells[0][1].value).toBe('')
    expect(inserted.cells[0][2].value).toBe('b1')
    expect(deleteColumn(inserted, 1).cells[0].map((cell) => cell.value)).toEqual(['a1', 'b1', 'c1'])
  })

  it('never drops below one row or column', () => {
    const single = createEmptyTable(1, 1)
    expect(deleteRow(single, 0).rowCount).toBe(1)
    expect(deleteColumn(single, 0).colCount).toBe(1)
  })
})

describe('merged cells', () => {
  it('keeps merges consistent when a row inside the merge is deleted', () => {
    const table = finalize({
      ...grid(),
      cells: grid().cells.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          if (rowIndex === 0 && colIndex === 0) return makeCell('merged', { rowSpan: 2, colSpan: 2 })
          return { ...cell }
        }),
      ),
    })
    expect(table.cells[0][0].rowSpan).toBe(2)
    expect(table.cells[1][1].covered).toBe(true)

    const afterDelete = deleteRow(table, 0)
    expect(afterDelete.rowCount).toBe(2)
    // rebuildCoverage folds text hidden under a merge into the anchor
    expect(afterDelete.cells[0][0].value).toBe('merged b1 a2 b2')
    // a 2×2 merge loses one row -> a 1×2 merge remains, consistent and covered
    expect(afterDelete.cells[0][0].rowSpan).toBe(1)
    expect(afterDelete.cells[0][0].colSpan).toBe(2)
    expect(afterDelete.cells[0][1].covered).toBe(true)
    expect(afterDelete.cells[1].some((cell) => cell.covered)).toBe(false)
  })

  it('grows a merge when a row is inserted inside it', () => {
    const table = finalize({
      ...grid(),
      cells: grid().cells.map((row, rowIndex) =>
        row.map((cell, colIndex) =>
          rowIndex === 0 && colIndex === 0 ? makeCell('block', { rowSpan: 2, colSpan: 1 }) : { ...cell },
        ),
      ),
    })
    const inserted = insertRow(table, 0, 'after')
    expect(inserted.cells[0][0].rowSpan).toBe(3)
    expect(inserted.cells[2][0].covered).toBe(true)
  })

  it('merges a rectangular region and folds the text', () => {
    const merged = mergeRegion(grid(), 0, 0, 1, 1)
    expect(merged.cells[0][0].value).toBe('a1 b1 a2 b2')
    expect(merged.cells[0][0].rowSpan).toBe(2)
    expect(merged.cells[1][1].covered).toBe(true)
    expect(flattenMerges(merged).cells[1][1].covered).toBe(false)
    expect(unmergeCell(merged, 0, 0).cells[1][1].covered).toBe(false)
  })
})

describe('paste', () => {
  it('pastes a TSV block and grows the table when needed', () => {
    const pasted = pasteBlock(grid(), 2, 2, 'x\ty\nz\tw')
    expect(pasted.rowCount).toBe(4)
    expect(pasted.colCount).toBe(4)
    expect(pasted.cells[2][2].value).toBe('x')
    expect(pasted.cells[3][3].value).toBe('w')
  })

  it('detects delimiters and respects quotes', () => {
    expect(detectDelimiter('a\tb\nc')).toBe('\t')
    expect(detectDelimiter('a;b\nc')).toBe(';')
    expect(detectDelimiter('a,b\nc')).toBe(',')
    expect(splitDelimitedRow('"hello, world";2', ';')).toEqual(['hello, world', '2'])
    expect(splitDelimitedRow('a\t"say ""hi"""\tc', '\t')).toEqual(['a', 'say "hi"', 'c'])
  })
})
