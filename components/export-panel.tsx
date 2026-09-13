'use client'

import { Check, ClipboardCopy, Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { copyTableToClipboard, downloadTable, tableToJson } from '@/lib/table/export'
import type { ExportFormat, ExtractedTable } from '@/lib/types'
import { cn, formatBytes, safeFileName } from '@/lib/utils'

interface ExportPanelProps {
  table: ExtractedTable
  defaultFileName: string
}

export function ExportPanel({ table, defaultFileName }: ExportPanelProps) {
  const [fileName, setFileName] = React.useState(defaultFileName)
  const [sheetName, setSheetName] = React.useState('Sheet1')
  const [smartNumbers, setSmartNumbers] = React.useState(true)
  const [status, setStatus] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<ExportFormat | 'copy' | null>(null)

  React.useEffect(() => {
    if (!defaultFileName) return
    setFileName((current) => (current ? current : defaultFileName))
  }, [defaultFileName])

  const run = async (format: ExportFormat) => {
    setBusy(format)
    setStatus(null)
    try {
      const result = await downloadTable(table, format, fileName, {
        sheetName,
        smartNumbers,
      })
      setStatus(`Saved ${result.fileName} (${formatBytes(result.bytes)})`)
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setBusy(null)
    }
  }

  const copy = async () => {
    setBusy('copy')
    try {
      await copyTableToClipboard(table)
      setStatus('Table copied as tab-separated text — paste straight into Excel or Sheets.')
    } catch {
      setStatus('Copy failed — your browser blocked clipboard access.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4 text-brand-600" aria-hidden="true" /> Export
        </CardTitle>
        <CardDescription>Everything below happens in your browser — the edited table never leaves your device again.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          File name
          <div className="flex items-center gap-1">
            <input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900 focus:border-brand-500 focus:outline-2 focus:outline-brand-200"
              aria-label="File name"
            />
            <span className="shrink-0 text-xs text-slate-400">.xlsx</span>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Sheet name (Excel)
          <input
            value={sheetName}
            onChange={(event) => setSheetName(event.target.value)}
            maxLength={31}
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900 focus:border-brand-500 focus:outline-2 focus:outline-brand-200"
            aria-label="Sheet name"
          />
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={smartNumbers}
            onChange={(event) => setSmartNumbers(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          <span>
            <strong className="font-semibold text-slate-800">Smart numbers.</strong> Convert clean values like
            {' '}<code className="font-mono">1,240.50</code> into real numbers so Excel can sum them. IDs with leading
            zeros stay text.
          </span>
        </label>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button onClick={() => run('xlsx')} disabled={busy !== null} className="col-span-2">
            {busy === 'xlsx' ? 'Preparing…' : <><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download .xlsx</>}
          </Button>
          <Button variant="outline" onClick={() => run('csv')} disabled={busy !== null}>
            <FileText className="h-4 w-4" aria-hidden="true" /> .csv
          </Button>
          <Button variant="outline" onClick={() => run('json')} disabled={busy !== null}>
            <FileJson className="h-4 w-4" aria-hidden="true" /> .json
          </Button>
          <Button variant="ghost" onClick={copy} disabled={busy !== null} className="col-span-2">
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy as TSV (paste into an existing sheet)
          </Button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn('flex min-h-5 items-center gap-1.5 text-xs', status?.startsWith('Export failed') || status?.startsWith('Copy failed') ? 'text-red-600' : 'text-brand-700')}
        >
          {status && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          {status}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Merged cells are preserved in .xlsx. JSON export ({formatBytes(new Blob([tableToJson(table)]).size)}) also
          includes merge regions and OCR stats — handy for automation.
        </p>
        <span className="sr-only">{safeFileName(fileName)}</span>
      </CardContent>
    </Card>
  )
}
