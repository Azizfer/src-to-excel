'use client'

import { AlertTriangle, FileImage, Loader2, ShieldCheck, Sparkles, Table2, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { Dropzone } from '@/components/dropzone'
import { ExportPanel } from '@/components/export-panel'
import { GridToolbar } from '@/components/grid-toolbar'
import { TableGrid, type SelectionRect } from '@/components/table-grid'
import { UsageMeter } from '@/components/usage-meter'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUpload } from '@/components/upload-context'
import { prepareForUpload } from '@/lib/client/prepare-upload'
import { PROVIDER_BLURBS, PROVIDER_LABELS } from '@/lib/constants'
import { sampleTable } from '@/lib/table/sample'
import { pasteBlock } from '@/lib/table/ops'
import type { ExtractedTable, ExtractFailure, ExtractResponse, ProviderId, UsageInfo } from '@/lib/types'
import { baseName, cn, formatBytes } from '@/lib/utils'

type Stage = 'idle' | 'extracting' | 'review'

interface History {
  past: ExtractedTable[][]
  future: ExtractedTable[][]
}

const HISTORY_LIMIT = 60

function snapshot(tables: ExtractedTable[]): ExtractedTable[][] {
  return [structuredClone(tables)]
}

export function ConversionWorkspace() {
  const { file, previewUrl, setFile } = useUpload()

  const [stage, setStage] = React.useState<Stage>('idle')
  const [error, setError] = React.useState<ExtractFailure['error'] | null>(null)
  const [tables, setTables] = React.useState<ExtractedTable[]>([])
  const [original, setOriginal] = React.useState<ExtractedTable[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [activeCell, setActiveCell] = React.useState<[number, number] | null>(null)
  const [selection, setSelection] = React.useState<SelectionRect | null>(null)
  const [history, setHistory] = React.useState<History>({ past: [], future: [] })
  const [usage, setUsage] = React.useState<UsageInfo | null>(null)
  const [provider, setProvider] = React.useState<ProviderId | null>(null)
  const [warnings, setWarnings] = React.useState<string[]>([])
  const [note, setNote] = React.useState<string | null>(null)
  const [sourceName, setSourceName] = React.useState('table')
  const [imageLabel, setImageLabel] = React.useState<string | null>(null)

  const startedFor = React.useRef<File | null>(null)

  const refreshUsage = React.useCallback(async () => {
    try {
      const response = await fetch('/api/usage', { cache: 'no-store' })
      const data = (await response.json()) as { usage?: UsageInfo }
      if (data.usage) setUsage(data.usage)
    } catch {
      /* usage meter is best-effort */
    }
  }, [])

  React.useEffect(() => {
    void refreshUsage()
  }, [refreshUsage])

  const startExtraction = React.useCallback(
    async (input: File) => {
      setStage('extracting')
      setError(null)
      setWarnings([])
      setNote(null)
      setSourceName(baseName(input.name || 'screenshot'))
      setImageLabel(`${input.name || 'screenshot'} · ${formatBytes(input.size)}`)
      try {
        const prepared = await prepareForUpload(input)
        if (prepared.upscaled) {
          setNote(
            `That screenshot is small (${prepared.width / 3 | 0}px wide), so we upscaled it in your browser before OCR for better accuracy.`,
          )
        }
        const form = new FormData()
        form.append('image', prepared.file, prepared.file.name)
        const response = await fetch('/api/extract', { method: 'POST', body: form })
        const data = (await response.json()) as ExtractResponse
        if (data.usage) setUsage(data.usage)
        if (!data.ok) {
          setError(data.error)
          setStage('idle')
          return
        }
        setTables(data.tables)
        setOriginal(structuredClone(data.tables))
        setProvider(data.provider)
        setWarnings(data.warnings)
        setActiveIndex(0)
        setHistory({ past: [], future: [] })
        setStage('review')
        void refreshUsage()
      } catch {
        setError({
          code: 'provider_error',
          message: 'Could not reach the server. Check your connection and try again.',
        })
        setStage('idle')
      }
    },
    [refreshUsage],
  )

  // Auto-start when a file arrives (from this page's dropzone or the landing page).
  React.useEffect(() => {
    if (!file || startedFor.current === file) return
    startedFor.current = file
    void startExtraction(file)
  }, [file, startExtraction])

  // Ctrl/Cmd+V anywhere: paste a screenshot straight from the clipboard.
  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (stage === 'review') return // the grid owns paste while reviewing
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith('image/'))
      const pasted = item?.getAsFile()
      if (pasted) {
        event.preventDefault()
        setFile(pasted)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage, setFile])

  const loadSample = () => {
    const sample = sampleTable()
    setTables([sample])
    setOriginal(structuredClone([sample]))
    setProvider('sample')
    setWarnings([])
    setNote(null)
    setError(null)
    setActiveIndex(0)
    setHistory({ past: [], future: [] })
    setSourceName('sample-q3-revenue')
    setImageLabel('Bundled sample — no image was uploaded')
    setStage('review')
  }

  const resetAll = () => {
    setFile(null)
    startedFor.current = null
    setStage('idle')
    setError(null)
    setTables([])
    setOriginal([])
    setWarnings([])
    setNote(null)
    setProvider(null)
    setImageLabel(null)
    void refreshUsage()
  }

  const activeTable = tables[activeIndex] ?? null

  const applyChange = React.useCallback(
    (mutator: (current: ExtractedTable[]) => ExtractedTable[]) => {
      setTables((current) => {
        setHistory((state) => ({
          past: [...state.past.slice(-(HISTORY_LIMIT - 1)), ...snapshot(current)],
          future: [],
        }))
        return mutator(current)
      })
    },
    [],
  )

  const updateActive = React.useCallback(
    (next: ExtractedTable) => {
      applyChange((current) => current.map((table, index) => (index === activeIndex ? next : table)))
    },
    [activeIndex, applyChange],
  )

  const undoChange = () => {
    if (!history.past.length) return
    const previous = history.past[history.past.length - 1]
    setHistory({ past: history.past.slice(0, -1), future: [structuredClone(tables), ...history.future].slice(0, HISTORY_LIMIT) })
    setTables(previous)
  }
  const redoChange = () => {
    if (!history.future.length) return
    const [next, ...rest] = history.future
    setHistory({ past: [...history.past, structuredClone(tables)].slice(-HISTORY_LIMIT), future: rest })
    setTables(next)
  }
  const resetTable = () => {
    applyChange((current) => current.map((table, index) => (index === activeIndex ? structuredClone(original[activeIndex]) : table)))
  }

  if (stage === 'extracting') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview of the uploaded screenshot" className="max-h-56 rounded-lg border border-slate-200 object-contain shadow-sm" />
            )}
            <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold text-slate-900">Reading the table structure…</p>
              <p className="mt-1 text-sm text-slate-500">
                Detecting rows, columns and merged cells. This usually takes a couple of seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (stage === 'review' && activeTable) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge tone="brand">
              <Table2 className="h-3 w-3" aria-hidden="true" />
              {provider ? PROVIDER_LABELS[provider] : 'Table'}
            </Badge>
            {imageLabel && <span className="truncate text-sm text-slate-600">{imageLabel}</span>}
            {provider && <span className="hidden text-xs text-slate-400 md:inline">{PROVIDER_BLURBS[provider]}</span>}
          </div>
          <div className="flex items-center gap-3">
            <UsageMeter usage={usage} />
            <Button variant="outline" size="sm" onClick={resetAll}>
              New image
            </Button>
          </div>
        </div>

        {(warnings.length > 0 || note) && (
          <div className="mb-4 space-y-2">
            {note && (
              <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {note}
              </p>
            )}
            {warnings.map((warning, index) => (
              <p key={index} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {warning}
              </p>
            ))}
          </div>
        )}

        {tables.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Detected tables">
            {tables.map((table, index) => (
              <button
                key={table.id}
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  index === activeIndex ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
                )}
              >
                {table.name} · {table.rowCount}×{table.colCount}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <GridToolbar
              table={activeTable}
              active={activeCell}
              selection={selection}
              onChange={(next) => {
                updateActive(next)
                setSelection(null)
              }}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              onUndo={undoChange}
              onRedo={redoChange}
              onReset={resetTable}
            />
            <TableGrid
              table={activeTable}
              onChange={updateActive}
              onActiveChange={setActiveCell}
              onSelectionChange={setSelection}
              onPasteBlock={(row, col, text) => updateActive(pasteBlock(activeTable, row, col, text))}
            />
            <p className="text-xs text-slate-500">
              Click a cell, then type or press <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono">Enter</kbd> to edit.
              Arrow keys move, <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono">Shift</kbd>+arrows
              selects a range (then Merge), <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono">Tab</kbd> steps across, pasting a copied
              range from Excel fills multiple cells. Amber cells are low-confidence OCR — please double-check them.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <ExportPanel table={activeTable} defaultFileName={sourceName} />
            <Card>
              <CardContent className="flex items-start gap-3 p-4 text-xs leading-relaxed text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  Your screenshot was processed in server memory and discarded. Nothing is stored, and the export
                  above is generated locally in your browser.{' '}
                  <a href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
                    Privacy details
                  </a>
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Convert a screenshot</h1>
        <p className="mt-2 text-slate-600">
          Upload a PNG/JPG/WebP of any table — dashboard, grade sheet, invoice, report — and edit the result before
          exporting.
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-red-800">{error.message}</p>
              {error.hint && <p className="mt-1 text-red-700">{error.hint}</p>}
              {error.code === 'rate_limited' && (
                <p className="mt-1 text-red-700">
                  The limit resets at midnight UTC. Need more today?{' '}
                  <a className="font-semibold underline underline-offset-2" href="/pricing">
                    See Pro options
                  </a>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dropzone onFile={(picked) => setFile(picked)} />

      <div className="mt-4 flex flex-col items-center gap-3">
        <button onClick={loadSample} className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
          No screenshot handy? Try a bundled sample table
        </button>
        <UsageMeter usage={usage} />
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
          Tip: press <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono">Ctrl</kbd>+
          <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono">V</kbd> anywhere on this page to
          paste a screenshot from your clipboard.
        </p>
      </div>
    </section>
  )
}
