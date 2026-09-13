import type { ExtractedTable } from '../types'
import { finalize, makeCell } from './model'

/**
 * Bundled demo table. Two jobs:
 *  1. lets a first-time visitor try the grid + export without uploading anything
 *  2. gives the OCR fallbacks something to compare against in tests
 */
export function sampleTable(): ExtractedTable {
  const rows: string[][] = [
    ['Region', 'Product', 'Units sold', 'Unit price', 'Revenue', 'Growth'],
    ['North', 'Analytics Seat', '1,240', '$18.00', '$22,320.00', '+12.4%'],
    ['North', 'API Credits', '860', '$4.50', '$3,870.00', '+3.1%'],
    ['South', 'Analytics Seat', '995', '$18.00', '$17,910.00', '+8.9%'],
    ['South', 'API Credits', '1,120', '$4.50', '$5,040.00', '-1.2%'],
    ['EMEA', 'Analytics Seat', '2,010', '$16.50', '$33,165.00', '+21.0%'],
    ['EMEA', 'API Credits', '740', '$4.20', '$3,108.00', '+4.6%'],
    ['APAC', 'Analytics Seat', '1,480', '$16.50', '$24,420.00', '+17.3%'],
    ['APAC', 'API Credits', '910', '$4.20', '$3,822.00', '+6.8%'],
  ]

  const confidences = [1, 0.98, 0.91, 0.72, 0.95, 0.88, 0.64, 0.97, 0.79]

  const table: ExtractedTable = {
    id: 'table-sample-q3-revenue',
    name: 'Q3 revenue by region',
    rowCount: rows.length,
    colCount: rows[0].length,
    headerRowCount: 1,
    provider: 'sample',
    lowConfidenceCount: 0,
    editedCount: 0,
    cells: rows.map((row, rowIndex) =>
      row.map((value, colIndex) =>
        makeCell(value, {
          // Header row is treated as certain; body cells carry a plausible spread
          // of OCR confidences so the review highlighting is visible.
          confidence: rowIndex === 0 ? 0.99 : confidences[(rowIndex + colIndex) % confidences.length],
        }),
      ),
    ),
  }
  return finalize(table)
}
