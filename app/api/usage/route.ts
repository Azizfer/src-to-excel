import { NextResponse } from 'next/server'

import { getConfig, resolveAutoProvider } from '@/lib/env'
import { cookieHeaderFor, peekUsage, resolveIdentity } from '@/lib/rate-limit/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lets the UI show "3 of 5 free conversions left today" before any upload. */
export async function GET(request: Request): Promise<NextResponse> {
  const config = getConfig()
  const identity = resolveIdentity(request)
  const cookieHeader = cookieHeaderFor(identity, request)
  const usage = await peekUsage(config, identity)
  return NextResponse.json(
    { ok: true, usage, provider: resolveAutoProvider(config) },
    { headers: { 'Cache-Control': 'no-store', ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}) } },
  )
}
