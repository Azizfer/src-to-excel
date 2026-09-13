'use client'

import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Redo2,
  RotateCcw,
  Rows3,
  Columns3,
  Merge,
  Split,
  Undo2,
  Unlink,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants'
import { mergeRegion, setHeaderRowCount, unmergeCell } from '@/lib/table/ops'
import { deleteColumn, deleteRow, flattenMerges, insertColumn, insertRow } from '@/lib/table/ops'
import type { ExtractedTable } from '@/lib/types'
import { cn, percent } from '@/lib/utils'

interface GridToolbarProps {
  table: ExtractedTable
  active: [number, number] | null
  onChange: (next: ExtractedTable) => void
  selection: { r0: number; c0: number; r1: number; c1: number } | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(tone === 'danger' && 'text-red-600 hover:bg-red-50')}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </Button>
  )
}

export function GridToolbar({
  table,
  active,
  onChange,
  selection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
}: GridToolbarProps) {
  const [row, col] = active ?? [0, 0]
  const activeCell = table.cells[row]?.[col]
  const hasMerge = Boolean(activeCell && (activeCell.rowSpan > 1 || activeCell.colSpan > 1))
  const hasMerges = table.cells.some((r) => r.some((c) => !c.covered && (c.rowSpan > 1 || c.colSpan > 1)))

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-1">
        <ToolButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Reset" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
        </ToolButton>
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-slate-200" />

      <div className="flex items-center gap-1">
        <ToolButton label="Row above" onClick={() => onChange(insertRow(table, row, 'before'))}>
          <ArrowUpToLine className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Row below" onClick={() => onChange(insertRow(table, row, 'after'))}>
          <ArrowDownToLine className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Delete row" tone="danger" disabled={table.rowCount <= 1} onClick={() => onChange(deleteRow(table, row))}>
          <Rows3 className="h-4 w-4" />
        </ToolButton>
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-slate-200" />

      <div className="flex items-center gap-1">
        <ToolButton label="Col left" onClick={() => onChange(insertColumn(table, col, 'before'))}>
          <ArrowLeftToLine className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Col right" onClick={() => onChange(insertColumn(table, col, 'after'))}>
          <ArrowRightToLine className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Delete col" tone="danger" disabled={table.colCount <= 1} onClick={() => onChange(deleteColumn(table, col))}>
          <Columns3 className="h-4 w-4" />
        </ToolButton>
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-slate-200" />

      <div className="flex items-center gap-1">
        <ToolButton
          label="Merge cells"
          onClick={() => selection && onChange(mergeRegion(table, selection.r0, selection.c0, selection.r1, selection.c1))}
          disabled={!selection || (selection.r0 === selection.r1 && selection.c0 === selection.c1)}
        >
          <Merge className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Split cell" onClick={() => onChange(unmergeCell(table, row, col))} disabled={!hasMerge}>
          <Split className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Flatten merges" onClick={() => onChange(flattenMerges(table))} disabled={!hasMerges}>
          <Unlink className="h-4 w-4" />
        </ToolButton>
      </div>

      <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={table.headerRowCount > 0}
          onChange={(event) => onChange(setHeaderRowCount(table, event.target.checked ? 1 : 0))}
          className="h-4 w-4 rounded border-slate-300 accent-brand-600"
        />
        Row 1 is a header
      </label>

      <div className="ml-auto flex items-center gap-3 pr-1 text-xs text-slate-500">
        <span>
          {table.rowCount} × {table.colCount}
        </span>
        <span title="Mean OCR confidence">conf {percent(table.averageConfidence)}</span>
        {table.lowConfidenceCount > 0 && (
          <span className="font-medium text-amber-700" title="Cells below the confidence threshold">
            {table.lowConfidenceCount} flagged
          </span>
        )}
        {table.editedCount > 0 && <span className="font-medium text-brand-700">{table.editedCount} edited</span>}
      </div>
      <span className="sr-only">{`Low confidence threshold ${LOW_CONFIDENCE_THRESHOLD}`}</span>
    </div>
  )
}
