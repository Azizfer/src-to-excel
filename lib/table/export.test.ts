import { describe, expect, it } from 'vitest'

import { finalize, makeCell } from './model'
import { coerceNumber, tableToCsv, tableToJson, tableToTsv, tableToXlsxBlob } from './export'
import { createEmptyTable } from './model'

function table() {
  const base = createEmptyTable(2, 3, { name: 'Sales' })
  base.headerRowCount = 1
  base.cells = [
    ['Region', 'Note', 'Revenue'].map((value) => makeCell(value)),
    ['North', 'line one\nline two', '1,240.50'].map((value) => makeCell(value)),
  ]
  return finalize(base)
}

describe('csv export', () => {
  it('quotes fields containing commas, quotes and newlines', () => {
    const csv = tableToCsv(table(), { csvBom: false })
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Region,Note,Revenue')
    expect(lines[1]).toBe('North,"line one\nline two","1,240.50"')
  })

  it('prefixes a BOM by default so Excel reads UTF-8', () => {
    expect(tableToCsv(table()).charCodeAt(0)).toBe(0xfeff)
  })
})

describe('smart numbers', () => {
  it('converts grouped decimals but keeps leading zeros and percents', () => {
    expect(coerceNumber('1,240.50')).toBe(1240.5)
    expect(coerceNumber('-42')).toBe(-42)
    expect(coerceNumber('007')).toBe('007')
    expect(coerceNumber('12%')).toBe('12%')
    expect(coerceNumber('')).toBe('')
  })
})

describe('xlsx export', () => {
  it('produces a real workbook buffer with merges', async () => {
    const base = table()
    base.cells[0][1] = makeCell('wide', { colSpan: 2 })
    const merged = finalize(base)
    const blob = await tableToXlsxBlob(merged, { sheetName: 'Sales Q3' })
    expect(blob.type).toContain('spreadsheetml')
    expect(blob.size).toBeGreaterThan(500)
    const buffer = Buffer.from(await blob.arrayBuffer())
    // ZIP local file header
    expect(buffer.readUInt32LE(0)).toBe(0x04034b50)
  })
})

describe('json + tsv export', () => {
  it('emits header-keyed records and stats', () => {
    const parsed = JSON.parse(tableToJson(table()))
    expect(parsed.header).toEqual(['Region', 'Note', 'Revenue'])
    expect(parsed.records[0].Region).toBe('North')
    expect(parsed.stats.provider).toBe('sample')
  })

  it('flattens newlines for TSV clipboard payloads', () => {
    expect(tableToTsv(table()).split('\n')[1]).toBe('North\tline one line two\t1,240.50')
  })
})
