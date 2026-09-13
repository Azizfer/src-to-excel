import { describe, expect, it } from 'vitest'

import { buildTableFromOcr, type OcrLine, type OcrPage, type OcrWord } from './structure'

function word(text: string, x0: number, x1: number, y0: number, y1: number, confidence = 92): OcrWord {
  return { text, confidence, bbox: { x0, y0, x1, y1 } }
}

function line(words: OcrWord[]): OcrLine {
  return {
    text: words.map((entry) => entry.text).join(' '),
    bbox: {
      x0: Math.min(...words.map((entry) => entry.bbox.x0)),
      y0: Math.min(...words.map((entry) => entry.bbox.y0)),
      x1: Math.max(...words.map((entry) => word1x(entry))),
      y1: Math.max(...words.map((entry) => entry.bbox.y1)),
    },
    words,
  }
}
const word1x = (entry: OcrWord) => entry.bbox.x1

const COLS = [
  [20, 160],
  [200, 340],
  [400, 560],
] as const

function tablePage(withTitle: boolean): OcrPage {
  const bodyRows = [
    ['Region', 'Units', 'Growth'],
    ['North', '1,240', '+12.4%'],
    ['South', '995', '+8.9%'],
    ['EMEA', '2,010', '+21.0%'],
  ]
  const lines: OcrLine[] = []
  let y = withTitle ? 64 : 20
  if (withTitle) {
    // A centred banner line: its words straddle the column separators instead
    // of sitting inside columns, which is what marks it as a spanning row.
    lines.push(
      line([
        word('Quarterly', 60, 110, 20, 44),
        word('sales', 120, 240, 20, 44),
        word('report', 320, 430, 20, 44),
        word('FY26', 450, 540, 20, 44),
      ]),
    )
  }
  for (const row of bodyRows) {
    row.forEach((text, colIndex) => {
      const [x0, x1] = COLS[colIndex]
      const width = Math.min(x1 - x0, text.length * 12)
      lines.push(line([word(text, x0, x0 + width, y, y + 24)]))
    })
    y += 44
  }
  return { width: 600, height: y + 20, lines }
}

describe('structure detection', () => {
  it('recovers rows, columns and values from word geometry', () => {
    const table = buildTableFromOcr(tablePage(false))
    expect(table).not.toBeNull()
    expect(table?.rowCount).toBe(4)
    expect(table?.colCount).toBe(3)
    expect(table?.cells[0].map((cell) => cell.value)).toEqual(['Region', 'Units', 'Growth'])
    expect(table?.cells[3].map((cell) => cell.value)).toEqual(['EMEA', '2,010', '+21.0%'])
    expect(table?.headerRowCount).toBe(1)
    expect(table?.averageConfidence).toBeGreaterThan(0.9)
  })

  it('detects a full-width title line as a merged cell', () => {
    const table = buildTableFromOcr(tablePage(true))
    expect(table?.rowCount).toBe(5)
    expect(table?.cells[0][0].value).toBe('Quarterly sales report FY26')
    expect(table?.cells[0][0].colSpan).toBe(3)
    expect(table?.cells[0][1].covered).toBe(true)
    // the merged title must not be mistaken for a header row
    expect(table?.headerRowCount).toBe(0)
  })

  it('returns null for running prose (no column structure)', () => {
    const prose: OcrLine[] = [
      line([
        word('The', 10, 90, 20, 44),
        word('quarterly', 100, 180, 20, 44),
        word('report', 190, 270, 20, 44),
        word('was', 280, 360, 20, 44),
        word('published', 370, 450, 20, 44),
      ]),
      line([
        word('yesterday', 10, 70, 64, 88),
        word('after', 80, 160, 64, 88),
        word('the', 170, 250, 64, 88),
        word('board', 260, 340, 64, 88),
        word('meeting', 350, 430, 64, 88),
        word('ended', 440, 520, 64, 88),
      ]),
      line([
        word('investors', 10, 110, 108, 132),
        word('received', 120, 220, 108, 132),
        word('copies', 230, 330, 108, 132),
        word('by', 340, 440, 108, 132),
        word('email', 450, 550, 108, 132),
      ]),
    ]
    expect(buildTableFromOcr({ width: 600, height: 160, lines: prose })).toBeNull()
  })

  it('flags low-confidence cells for review', () => {
    const page = tablePage(false)
    page.lines[6].words[0].confidence = 41 // third body row, first column ("South")
    const table = buildTableFromOcr(page)
    expect(table?.lowConfidenceCount).toBe(1)
    expect(table?.cells[2][0].confidence).toBeLessThan(0.75)
  })
})
