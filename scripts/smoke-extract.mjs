#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server:
 *
 *   npm run dev &
 *   npm run fixtures
 *   npm run smoke -- .fixtures/clean.png .fixtures/grades.png
 *
 * Prints the detected table as aligned text plus confidence and usage info.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const files = process.argv.slice(2)

if (!files.length) {
  console.error('Usage: npm run smoke -- <image...>   (try: npm run fixtures first)')
  process.exit(1)
}

function printTable(table) {
  const matrix = table.cells.map((row) =>
    row.map((cell) => (cell.covered ? '⤴' : cell.value || '·')),
  )
  const widths = matrix[0].map((_, col) =>
    Math.max(...matrix.map((row) => String(row[col]).length), 3),
  )
  const line = (row) => `  | ${row.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ')} |`
  console.log(`  ${table.name} (${table.rowCount}×${table.colCount}, header=${table.headerRowCount}, conf=${(table.averageConfidence ?? 0).toFixed(2)}, flagged=${table.lowConfidenceCount})`)
  console.log(line(matrix[0]))
  console.log(`  |${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`)
  for (const row of matrix.slice(1)) console.log(line(row))
}

for (const file of files) {
  const buffer = await readFile(file)
  const form = new FormData()
  form.append('image', new Blob([buffer], { type: 'image/png' }), path.basename(file))

  const started = Date.now()
  const response = await fetch(`${BASE_URL}/api/extract`, { method: 'POST', body: form })
  const data = await response.json()

  console.log(`\n=== ${path.basename(file)} -> HTTP ${response.status} in ${Date.now() - started}ms`)
  if (!data.ok) {
    console.log(`  error: [${data.error.code}] ${data.error.message}`)
    if (data.error.hint) console.log(`  hint:  ${data.error.hint}`)
    continue
  }
  console.log(`  provider=${data.provider} image=${data.image.width}x${data.image.height} usage=${data.usage.used}/${data.usage.limit}`)
  for (const warning of data.warnings ?? []) console.log(`  warning: ${warning}`)
  for (const table of data.tables) printTable(table)
}
