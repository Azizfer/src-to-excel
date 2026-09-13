'use client'

import Link from 'next/link'

import type { UsageInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

export function UsageMeter({ usage, className }: { usage: UsageInfo | null; className?: string }) {
  if (!usage || usage.limited === undefined) return null
  const used = Math.min(usage.used, usage.limit)
  const remaining = Math.max(0, usage.limit - used)
  const ratio = usage.limit > 0 ? used / usage.limit : 0
  const resetDate = new Date(usage.resetAt)

  return (
    <div className={cn('flex items-center gap-3 text-xs text-slate-600', className)}>
      <div className="flex items-center gap-2">
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={usage.limit}
          aria-valuenow={used}
          aria-label={`Free conversions used today: ${used} of ${usage.limit}`}
          className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className={cn('h-full rounded-full transition-all', remaining === 0 ? 'bg-red-500' : ratio > 0.6 ? 'bg-amber-500' : 'bg-brand-500')}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
        <span className={cn('font-medium', remaining === 0 && 'text-red-600')}>
          {remaining === 0 ? 'No free conversions left today' : `${remaining} of ${usage.limit} free conversions left`}
        </span>
      </div>
      <span className="text-slate-400">
        resets{' '}
        {resetDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
      </span>
      {remaining === 0 && (
        <Link href="/pricing" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
          See Pro options
        </Link>
      )}
    </div>
  )
}
