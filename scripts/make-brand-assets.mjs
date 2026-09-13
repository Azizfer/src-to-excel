#!/usr/bin/env node
/**
 * Renders the social/OG cover into public/og-cover.png (1200×630).
 * Deterministic SVG → PNG via sharp, so the asset can be regenerated anywhere:
 *
 *   node scripts/make-brand-assets.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '..', 'public', 'og-cover.png')

const FONT = 'DejaVu Sans, Arial, sans-serif'

const ROWS = [
  ['Region', 'Units', 'Revenue'],
  ['North', '1,240', '$22,320'],
  ['South', '995', '$17,910'],
  ['EMEA', '2,010', '$33,165'],
]

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const table = (() => {
  const x0 = 660
  const y0 = 200
  const colW = [150, 110, 140]
  const rowH = 56
  const parts = []
  ROWS.forEach((row, rowIndex) => {
    let x = x0
    row.forEach((cell, colIndex) => {
      const header = rowIndex === 0
      parts.push(
        `<rect x="${x}" y="${y0 + rowIndex * rowH}" width="${colW[colIndex]}" height="${rowH}" fill="${header ? '#047857' : rowIndex % 2 ? '#0b1220' : '#111c33'}" stroke="#1e3a5f" stroke-width="1"/>`,
        `<text x="${x + 16}" y="${y0 + rowIndex * rowH + rowH * 0.64}" font-family="${FONT}" font-size="24" font-weight="${header ? 'bold' : 'normal'}" fill="${header ? '#d1fae5' : '#e2e8f0'}">${escapeXml(cell)}</text>`,
      )
      x += colW[colIndex]
    })
  })
  return parts.join('')
})()

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <g stroke="#1e293b" stroke-width="1">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 52}" y1="0" x2="${i * 52}" y2="630"/>`).join('')}
    ${Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 52}" x2="1200" y2="${i * 52}"/>`).join('')}
  </g>
  <rect x="80" y="96" width="56" height="56" rx="14" fill="#059669"/>
  <g stroke="#ffffff" stroke-width="4" fill="none">
    <rect x="92" y="108" width="32" height="32" rx="4"/>
    <line x1="92" y1="120" x2="124" y2="120"/>
    <line x1="104" y1="108" x2="104" y2="140"/>
  </g>
  <text x="152" y="134" font-family="${FONT}" font-size="30" font-weight="bold" fill="#e2e8f0">Screenshot → Excel</text>
  <text x="80" y="238" font-family="${FONT}" font-size="64" font-weight="bold" fill="#f8fafc">Turn any screenshot</text>
  <text x="80" y="312" font-family="${FONT}" font-size="64" font-weight="bold" fill="#34d399">into an editable table</text>
  <text x="80" y="376" font-family="${FONT}" font-size="28" fill="#94a3b8">Rows, columns and merged cells detected.</text>
  <text x="80" y="416" font-family="${FONT}" font-size="28" fill="#94a3b8">Fix mistakes in the grid, export .xlsx / .csv.</text>
  <text x="80" y="520" font-family="${FONT}" font-size="24" fill="#64748b">Free · no signup · images never stored</text>
  ${table}
</svg>`

await sharp(Buffer.from(svg), { density: 150 }).png().toFile(out)
console.log('wrote', path.relative(process.cwd(), out))
