'use client'

import { ImagePlus, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
import { validateFile } from '@/lib/client/prepare-upload'
import { cn, formatBytes } from '@/lib/utils'

interface DropzoneProps {
  onFile: (file: File) => void
  busy?: boolean
  busyLabel?: string
  compact?: boolean
  className?: string
}

export function Dropzone({ onFile, busy = false, busyLabel = 'Working…', compact = false, className }: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const depth = React.useRef(0)

  const accept = React.useCallback(
    (file: File | undefined | null) => {
      if (!file) return
      const problem = validateFile(file)
      if (problem) {
        setError(problem)
        return
      }
      setError(null)
      onFile(file)
    },
    [onFile],
  )

  return (
    <div className={cn('w-full', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a screenshot of a table"
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!busy) inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          depth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          depth.current -= 1
          if (depth.current <= 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          depth.current = 0
          setDragging(false)
          accept(event.dataTransfer.files?.[0])
        }}
        className={cn(
          'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40',
          compact ? 'px-4 py-6' : 'px-6 py-12',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className={compact ? 'h-5 w-5' : 'h-7 w-7'} />}
        </span>
        <div>
          <p className={cn('font-semibold text-slate-900', compact ? 'text-sm' : 'text-base')}>
            {busy ? busyLabel : dragging ? 'Drop it right here' : 'Drop a screenshot, or click to browse'}
          </p>
          <p className={cn('mt-1 text-slate-500', compact ? 'text-xs' : 'text-sm')}>
            PNG, JPG or WebP · up to {formatBytes(MAX_UPLOAD_BYTES)} · or paste with{' '}
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono text-[11px]">Ctrl</kbd>+
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono text-[11px]">V</kbd>
          </p>
        </div>
        <Button size={compact ? 'sm' : 'md'} variant="outline" tabIndex={-1} aria-hidden="true">
          Choose image
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
