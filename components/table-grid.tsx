'use client'

import * as React from 'react'

import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants'
import { anchorMap } from '@/lib/table/model'
import { setCellValue } from '@/lib/table/ops'
import type { ExtractedTable } from '@/lib/types'
import { cn, columnLabel, percent } from '@/lib/utils'

export interface SelectionRect {
  r0: number
  c0: number
  r1: number
  c1: number
}

interface TableGridProps {
  table: ExtractedTable
  onChange: (next: ExtractedTable) => void
  /** Notifies the parent which cell is active so toolbar actions can target it. */
  onActiveChange?: (cell: [number, number] | null) => void
  onSelectionChange?: (rect: SelectionRect | null) => void
  onPasteBlock?: (row: number, col: number, text: string) => void
}

function normalizeRect(anchor: [number, number], focus: [number, number]): SelectionRect {
  return {
    r0: Math.min(anchor[0], focus[0]),
    c0: Math.min(anchor[1], focus[1]),
    r1: Math.max(anchor[0], focus[0]),
    c1: Math.max(anchor[1], focus[1]),
  }
}

/**
 * Spreadsheet-style editable grid.
 *
 * - roving tabindex + arrow-key navigation (keyboard accessible, per the plan)
 * - Enter / F2 / typing starts editing, Esc cancels, Enter commits and steps down
 * - low-confidence OCR cells are highlighted amber instead of silently guessed
 * - merged cells render as real rowSpan/colSpan and behave as one cell
 */
export function TableGrid({ table, onChange, onActiveChange, onSelectionChange, onPasteBlock }: TableGridProps) {
  const [active, setActive] = React.useState<[number, number]>([0, 0])
  const [selection, setSelection] = React.useState<{ anchor: [number, number]; focus: [number, number] } | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const cellRefs = React.useRef(new Map<string, HTMLTableCellElement>())
  const interacted = React.useRef(false)
  const anchors = React.useMemo(() => anchorMap(table), [table])

  const safeActive: [number, number] = [
    Math.min(active[0], table.rowCount - 1),
    Math.min(active[1], table.colCount - 1),
  ]
  const [activeRow, activeCol] = anchors[safeActive[0]]?.[safeActive[1]] ?? safeActive

  React.useEffect(() => {
    onActiveChange?.([activeRow, activeCol])
  }, [activeRow, activeCol, onActiveChange])

  const rect = React.useMemo(
    () => (selection ? normalizeRect(selection.anchor, selection.focus) : null),
    [selection],
  )
  React.useEffect(() => {
    onSelectionChange?.(rect)
  }, [rect, onSelectionChange])

  // Keep focus on the active cell as the user navigates with keys.
  React.useEffect(() => {
    if (!interacted.current || editing) return
    const element = cellRefs.current.get(`${activeRow},${activeCol}`)
    element?.focus({ preventScroll: false })
  }, [activeRow, activeCol, editing])

  const moveTo = React.useCallback(
    (row: number, col: number, extend: boolean) => {
      row = Math.max(0, Math.min(table.rowCount - 1, row))
      col = Math.max(0, Math.min(table.colCount - 1, col))
      const [anchorRow, anchorCol] = anchors[row]?.[col] ?? [row, col]
      if (extend) {
        setSelection((current) => ({
          anchor: current?.anchor ?? [activeRow, activeCol],
          focus: [anchorRow, anchorCol],
        }))
      } else {
        setSelection(null)
      }
      setActive([anchorRow, anchorCol])
    },
    [activeRow, activeCol, anchors, table.rowCount, table.colCount],
  )

  const move = React.useCallback(
    (deltaRow: number, deltaCol: number, extend = false) => moveTo(activeRow + deltaRow, activeCol + deltaCol, extend),
    [activeRow, activeCol, moveTo],
  )

  const startEditing = React.useCallback(
    (initial?: string) => {
      setDraft(initial ?? table.cells[activeRow]?.[activeCol]?.value ?? '')
      setEditing(true)
    },
    [activeRow, activeCol, table],
  )

  const commit = React.useCallback(() => {
    onChange(setCellValue(table, activeRow, activeCol, draft))
    setEditing(false)
  }, [activeCol, activeRow, draft, onChange, table])

  const cancel = React.useCallback(() => setEditing(false), [])

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    if (editing) return // the <input> owns the keyboard while editing
    interacted.current = true
    const key = event.key
    if (key === 'Escape' && selection) {
      event.preventDefault()
      return setSelection(null)
    }
    if (key === 'ArrowUp') return event.preventDefault(), move(-1, 0, event.shiftKey)
    if (key === 'ArrowDown') return event.preventDefault(), move(1, 0, event.shiftKey)
    if (key === 'ArrowLeft') return event.preventDefault(), move(0, -1, event.shiftKey)
    if (key === 'ArrowRight') return event.preventDefault(), move(0, 1, event.shiftKey)
    if (key === 'Tab') return event.preventDefault(), move(0, event.shiftKey ? -1 : 1)
    if (key === 'Enter' || key === 'F2') {
      event.preventDefault()
      return startEditing()
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault()
      return onChange(setCellValue(table, activeRow, activeCol, ''))
    }
    if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      return startEditing(key)
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const text = event.clipboardData.getData('text/plain')
    if (!text) return
    event.preventDefault()
    if (onPasteBlock && (/[\t]/.test(text) || text.includes('\n'))) {
      onPasteBlock(activeRow, activeCol, text)
      return
    }
    onChange(setCellValue(table, activeRow, activeCol, text))
  }

  const headerRow = table.headerRowCount > 0

  return (
    <div className="sheet-scroll max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table
        role="grid"
        aria-label={`${table.name}: ${table.rowCount} rows by ${table.colCount} columns. Use arrow keys to move, Enter to edit.`}
        aria-rowcount={table.rowCount}
        aria-colcount={table.colCount}
        onKeyDown={handleGridKeyDown}
        onPaste={handlePaste}
        className="w-max min-w-full border-separate border-spacing-0 text-sm"
      >
        <thead>
          <tr>
            <th
              scope="col"
              aria-hidden="true"
              className="sticky left-0 top-0 z-30 w-12 min-w-12 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-500"
            />
            {Array.from({ length: table.colCount }, (_, col) => (
              <th
                key={col}
                scope="col"
                aria-hidden="true"
                className={cn(
                  'sticky top-0 z-20 min-w-[9rem] border-b border-r border-slate-200 bg-slate-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-600',
                  col === activeCol && 'bg-brand-100 text-brand-800',
                )}
              >
                {columnLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.cells.map((row, rowIndex) => {
            const isHeaderRow = headerRow && rowIndex === 0
            return (
              <tr key={rowIndex} role="row" aria-rowindex={rowIndex + 1}>
                <th
                  scope="row"
                  aria-hidden="true"
                  className={cn(
                    'sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-right text-xs font-medium text-slate-500',
                    rowIndex === activeRow && 'bg-brand-100 text-brand-800',
                  )}
                >
                  {rowIndex + 1}
                </th>
                {row.map((cell, colIndex) => {
                  if (cell.covered) return null
                  const isActive = rowIndex === activeRow && colIndex === activeCol
                  const inSelection = Boolean(
                    rect && rowIndex >= rect.r0 && rowIndex <= rect.r1 && colIndex >= rect.c0 && colIndex <= rect.c1,
                  )
                  const lowConfidence =
                    typeof cell.confidence === 'number' &&
                    cell.confidence < LOW_CONFIDENCE_THRESHOLD &&
                    !cell.edited
                  const refKey = `${rowIndex},${colIndex}`
                  return (
                    <td
                      key={colIndex}
                      ref={(element) => {
                        if (element) cellRefs.current.set(refKey, element)
                        else cellRefs.current.delete(refKey)
                      }}
                      role={isHeaderRow ? 'columnheader' : 'gridcell'}
                      aria-rowindex={rowIndex + 1}
                      aria-colindex={colIndex + 1}
                      aria-selected={isActive}
                      rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                      colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                      tabIndex={isActive ? 0 : -1}
                      onFocus={() => {
                        interacted.current = true
                        setActive([rowIndex, colIndex])
                      }}
                      onClick={(event) => {
                        interacted.current = true
                        if (event.shiftKey) {
                          setSelection((current) => ({
                            anchor: current?.anchor ?? [activeRow, activeCol],
                            focus: [rowIndex, colIndex],
                          }))
                        } else {
                          setSelection(null)
                        }
                        setActive([rowIndex, colIndex])
                      }}
                      onDoubleClick={() => startEditing()}
                      title={
                        lowConfidence
                          ? `Low OCR confidence (${percent(cell.confidence)}) — double-check this cell`
                          : cell.edited
                            ? 'Edited by you'
                            : typeof cell.confidence === 'number'
                              ? `OCR confidence ${percent(cell.confidence)}`
                              : undefined
                      }
                      className={cn(
                        'relative max-w-[22rem] cursor-cell border-b border-r border-slate-200 px-3 py-1.5 align-top',
                        isHeaderRow ? 'font-semibold text-slate-800' : 'text-slate-700',
                        lowConfidence && 'bg-amber-50 text-amber-900',
                        cell.edited && !lowConfidence && 'bg-brand-50/60',
                        inSelection && !isActive && 'bg-brand-100/70',
                        !cell.value && 'text-slate-400',
                        isActive &&
                          'z-10 ring-2 ring-inset ring-brand-500 ' + (lowConfidence ? 'bg-amber-100' : 'bg-white'),
                      )}
                    >
                      {isActive && editing ? (
                        <input
                          autoFocus
                          value={draft}
                          aria-label={`Edit cell ${columnLabel(colIndex)}${rowIndex + 1}`}
                          onChange={(event) => setDraft(event.target.value)}
                          onFocus={(event) => event.target.select()}
                          onBlur={commit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.stopPropagation()
                              commit()
                              move(1, 0)
                            } else if (event.key === 'Tab') {
                              event.preventDefault()
                              event.stopPropagation()
                              commit()
                              move(0, event.shiftKey ? -1 : 1)
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              event.stopPropagation()
                              cancel()
                            }
                          }}
                          className="-mx-1 -my-0.5 w-[calc(100%+0.5rem)] rounded border border-brand-400 bg-white px-1 py-0.5 text-sm text-slate-900 outline-none ring-2 ring-brand-200"
                        />
                      ) : (
                        <span className={cn('block truncate', lowConfidence && 'underline decoration-amber-400 decoration-dashed underline-offset-2')}>
                          {cell.value || ''}
                        </span>
                      )}
                      {lowConfidence && !(isActive && editing) && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
