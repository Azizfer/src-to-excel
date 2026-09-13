import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** `0 -> A`, `25 -> Z`, `26 -> AA` — spreadsheet column labels for the grid gutter. */
export function columnLabel(index: number): string {
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function percent(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `sales-dashboard.png` -> `sales-dashboard` */
export function baseName(fileName: string): string {
  const cleaned = fileName.replace(/\\/g, '/').split('/').pop() ?? 'table'
  const dot = cleaned.lastIndexOf('.')
  return dot > 0 ? cleaned.slice(0, dot) : cleaned
}

export function safeFileName(name: string, fallback = 'table'): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w\-. ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return cleaned || fallback
}
