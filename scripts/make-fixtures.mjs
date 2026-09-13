#!/usr/bin/env node
/**
 * Generates deterministic PNG "screenshots of tables" into `.fixtures/` so the
 * extraction pipeline can be smoke-tested without hunting for real screenshots.
 *
 *   npm run fixtures          # render all fixtures
 *   node scripts/make-fixtures.mjs clean
 *
 * Uses sharp's SVG rasteriser (librsvg + fontconfig), so the only system
 * requirement is a sans-serif font — DejaVu is enough.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '.fixtures')

const FONT = 'DejaVu Sans, Arial, sans-serif'

/**
 * Render an HTML-ish table as SVG.
 * @param {object} opts
 * @param {string[][]} opts.rows
 * @param {number} [opts.colWidths]
 * @param {boolean} [opts.grid]      draw vertical rules (bordered table)
 * @param {string} [opts.title]      merged title row spanning all columns
 * @param {number} [opts.fontSize]
 */
function tableSvg({ rows, grid = true, title = null, fontSize = 17, rowHeight = 42, padding = 14 }) {
  const colCount = rows[0].length
  const widths = rows.reduce(
    (acc, row) =>
      row.map((cell, index) => Math.max(acc[index] ?? 0, String(cell).length * fontSize * 0.6 + padding * 2)),
    Array(colCount).fill(90),
  )
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const titleHeight = title ? rowHeight + 8 : 0
  const totalHeight = rows.length * rowHeight + titleHeight + 24

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth + 2}" height="${totalHeight}" viewBox="0 0 ${totalWidth + 2} ${totalHeight}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<g font-family="${FONT}" font-size="${fontSize}" fill="#0f172a">`,
  )

  let y = 12
  if (title) {
    parts.push(
      `<text x="${totalWidth / 2}" y="${y + rowHeight * 0.66}" text-anchor="middle" font-size="${fontSize + 4}" font-weight="bold">${escapeXml(title)}</text>`,
    )
    y += titleHeight
  }

  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0
    if (isHeader) {
      parts.push(`<rect x="1" y="${y}" width="${totalWidth}" height="${rowHeight}" fill="#eef2ff"/>`)
    } else if (rowIndex % 2 === 0) {
      parts.push(`<rect x="1" y="${y}" width="${totalWidth}" height="${rowHeight}" fill="#f8fafc"/>`)
    }
    let x = 1
    row.forEach((cell, colIndex) => {
      const numeric = /^[-$€£]?[\d.,%$€£+\-\s]+$/.test(String(cell).trim()) && String(cell).trim() !== ''
      parts.push(
        `<text x="${x + (numeric ? widths[colIndex] - padding : padding)}" y="${y + rowHeight * 0.64}" ` +
          `text-anchor="${numeric ? 'end' : 'start'}" font-weight="${isHeader ? 'bold' : 'normal'}">${escapeXml(cell)}</text>`,
      )
      if (grid && colIndex > 0) {
        parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + rowHeight}" stroke="#cbd5e1" stroke-width="1"/>`)
      }
      x += widths[colIndex]
    })
    parts.push(`<line x1="1" y1="${y}" x2="${totalWidth + 1}" y2="${y}" stroke="#94a3b8" stroke-width="1"/>`)
    y += rowHeight
  })
  parts.push(`<line x1="1" y1="${y}" x2="${totalWidth + 1}" y2="${y}" stroke="#94a3b8" stroke-width="1"/>`)
  if (grid) {
    parts.push(`<line x1="1" y1="12" x2="1" y2="${y}" stroke="#94a3b8" stroke-width="1"/>`)
    parts.push(`<line x1="${totalWidth + 1}" y1="12" x2="${totalWidth + 1}" y2="${y}" stroke="#94a3b8" stroke-width="1"/>`)
  }
  parts.push(`</g></svg>`)
  return { svg: parts.join(''), width: Math.round(totalWidth + 2), height: Math.round(totalHeight) }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const FIXTURES = {
  /** Clean, bordered dashboard table — the easy case. */
  clean: {
    rows: [
      ['Region', 'Product', 'Units', 'Unit price', 'Revenue', 'Growth'],
      ['North', 'Analytics Seat', '1,240', '$18.00', '$22,320.00', '+12.4%'],
      ['North', 'API Credits', '860', '$4.50', '$3,870.00', '+3.1%'],
      ['South', 'Analytics Seat', '995', '$18.00', '$17,910.00', '+8.9%'],
      ['South', 'API Credits', '1,120', '$4.50', '$5,040.00', '-1.2%'],
      ['EMEA', 'Analytics Seat', '2,010', '$16.50', '$33,165.00', '+21.0%'],
      ['APAC', 'Analytics Seat', '1,480', '$16.50', '$24,420.00', '+17.3%'],
    ],
    grid: true,
  },
  /** Grade sheet: merged title row, no vertical rules, mixed text. */
  grades: {
    title: 'Autumn 2025 — Data Structures (CS-204)',
    rows: [
      ['Student ID', 'Student name', 'Midterm', 'Final', 'Project', 'Grade'],
      ['20231014', 'Amira Ben Salah', '82', '91', '88', 'A'],
      ['20231077', 'Lucas Moreau', '74', '68', '81', 'B'],
      ['20231102', 'Yuki Tanaka', '95', '89', '93', 'A'],
      ['20231145', 'Omar Haddad', '61', '58', '70', 'C'],
      ['20231188', 'Sofia Rossi', '88', '84', '90', 'A'],
    ],
    grid: false,
  },
  /** Invoice-style table with a totals row. */
  invoice: {
    title: 'Invoice #INV-2041 — Acme Supply Co.',
    rows: [
      ['Item', 'Qty', 'Rate', 'Amount'],
      ['A4 paper ream', '12', '4.25', '51.00'],
      ['Toner cartridge CF410A', '3', '38.90', '116.70'],
      ['Stapler heavy duty', '2', '11.40', '22.80'],
      ['Subtotal', '', '', '190.50'],
      ['VAT 19%', '', '', '36.20'],
      ['Total due', '', '', '226.70'],
    ],
    grid: true,
  },
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const wanted = process.argv.slice(2)
  const names = wanted.length ? wanted : Object.keys(FIXTURES)

  for (const name of names) {
    const fixture = FIXTURES[name]
    if (!fixture) {
      console.error(`Unknown fixture "${name}". Available: ${Object.keys(FIXTURES).join(', ')}`)
      process.exitCode = 1
      continue
    }
    const { svg, width, height } = tableSvg(fixture)
    let image = sharp(Buffer.from(svg), { density: 200 }).png()

    if (name === 'lowres') {
      image = image.resize({ width: Math.round(width / 2) })
    }
    const file = path.join(outDir, `${name}.png`)
    const info = await image.toFile(file)
    console.log(`wrote ${path.relative(process.cwd(), file)} (${info.width}x${info.height}, ${info.size} bytes)`)
  }
}

// A deliberately low-quality variant of `clean` to exercise the "small image" warning.
FIXTURES.lowres = { ...FIXTURES.clean, fontSize: 11, rowHeight: 24 }

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
