import { NextResponse } from 'next/server'

import { getConfig, resolveAutoProvider } from '@/lib/env'
import { localEngineStatus } from '@/lib/extract/local'
import { getUsageStore } from '@/lib/rate-limit/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health — which extraction provider will serve requests right now.
 * Useful on deploy day: `curl $URL/api/health | jq`.
 */
export async function GET(): Promise<NextResponse> {
  const config = getConfig()
  return NextResponse.json(
    {
      ok: true,
      service: 'screenshot-to-excel',
      provider: resolveAutoProvider(config),
      providers: {
        textract: { configured: config.aws.configured, region: config.aws.region },
        local: localEngineStatus(config),
      },
      rateLimit: { store: getUsageStore(config).kind, freeDailyLimit: config.freeDailyLimit },
      maxUploadBytes: config.maxUploadBytes,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
