import { NextResponse } from 'next/server'

import { ACCEPTED_MIME_TYPES } from '@/lib/constants'
import { getConfig } from '@/lib/env'
import { NoTableError, ProviderError, extractTables } from '@/lib/extract'
import { describeUnsupported, readDimensions, sniffMime, InputError } from '@/lib/extract/validate'
import { consumeUsage, cookieHeaderFor, releaseUsage, resolveIdentity } from '@/lib/rate-limit/usage'
import type { ErrorCode, ExtractFailure, UsageInfo } from '@/lib/types'

/**
 * POST /api/extract
 *   multipart/form-data with an `image` file field (what the web UI sends)
 *   or JSON `{ "image": "<base64 | data-url>" }` (what the future public API will send)
 *
 * Privacy contract: the bytes live only in this function's memory, are handed
 * straight to the provider, and are garbage-collected with the request. No disk,
 * no S3, no logs of image content.
 */
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function failure(
  code: ErrorCode,
  message: string,
  status: number,
  extra: { usage?: UsageInfo; hint?: string; headers?: HeadersInit } = {},
): NextResponse {
  const body: ExtractFailure = { ok: false, error: { code, message, hint: extra.hint } }
  if (extra.usage) body.usage = extra.usage
  return NextResponse.json(body, { status, headers: extra.headers })
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = getConfig()
  const identity = resolveIdentity(request)
  const cookieHeader = cookieHeaderFor(identity, request)
  const headers: HeadersInit = {
    'Cache-Control': 'no-store',
    ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}),
  }

  // --- 1. read + validate the upload -------------------------------------
  let buffer: Buffer | null = null
  let fileName = 'screenshot'
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('image')
      if (!(file instanceof File)) {
        return failure('bad_request', 'Upload must include an "image" file field.', 400, { headers })
      }
      fileName = file.name || 'screenshot'
      if (file.size > config.maxUploadBytes) {
        return failure('too_large', `That file is too large (${(file.size / 1e6).toFixed(1)} MB). The limit is ${Math.round(config.maxUploadBytes / 1e6)} MB.`, 413, { headers })
      }
      buffer = Buffer.from(await file.arrayBuffer())
    } else {
      const payload = (await request.json()) as { image?: unknown; fileName?: unknown }
      if (typeof payload.image !== 'string' || !payload.image.length) {
        return failure('bad_request', 'Send multipart/form-data with an "image" file, or JSON { image: "<base64>" }.', 400, { headers })
      }
      const raw = payload.image.includes('base64,')
        ? payload.image.slice(payload.image.indexOf('base64,') + 'base64,'.length)
        : payload.image
      buffer = Buffer.from(raw, 'base64')
      if (typeof payload.fileName === 'string') fileName = payload.fileName
    }
  } catch {
    return failure('bad_request', 'Could not read the request body as an image upload.', 400, { headers })
  }

  if (!buffer || buffer.byteLength === 0) {
    return failure('invalid_image', 'The uploaded file is empty.', 400, { headers })
  }
  if (buffer.byteLength > config.maxUploadBytes) {
    return failure('too_large', `That image is too large (${(buffer.byteLength / 1e6).toFixed(1)} MB). The limit is ${Math.round(config.maxUploadBytes / 1e6)} MB.`, 413, { headers })
  }

  const mime = sniffMime(buffer)
  if (!mime || !(ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)) {
    return failure('unsupported_type', describeUnsupported(mime ?? ''), 415, { headers })
  }
  const dims = readDimensions(buffer, mime)

  // --- 2. free-tier gate (server-side, per the plan) ----------------------
  const { allowed, usage } = await consumeUsage(config, identity)
  if (!allowed) {
    return failure(
      'rate_limited',
      `You have used all ${config.freeDailyLimit} free conversions for today. Come back after ${new Date(usage.resetAt).toUTCString().slice(0, 22)} UTC, or join the Pro waitlist.`,
      429,
      { usage, headers, hint: 'Pro (unlimited conversions, batch upload) is on the roadmap — see /pricing.' },
    )
  }

  // --- 3. extract ----------------------------------------------------------
  const startedAt = Date.now()
  try {
    const output = await extractTables(buffer, mime, config)
    return NextResponse.json(
      {
        ok: true,
        provider: output.provider,
        tables: output.tables,
        image: { bytes: buffer.byteLength, mime, width: dims.width, height: dims.height },
        usage,
        timingMs: Date.now() - startedAt,
        warnings: output.warnings,
        fileName,
      },
      { status: 200, headers },
    )
  } catch (error) {
    // The conversion failed, so the credit goes back.
    await releaseUsage(config, identity).catch(() => {})

    if (error instanceof NoTableError) {
      return failure(
        'no_table',
        'We could not find a table in this image.',
        422,
        {
          usage,
          headers,
          hint: 'Crop the screenshot tightly around the table, use a higher resolution, and make sure the grid lines or column spacing are visible.',
        },
      )
    }
    if (error instanceof ProviderError) {
      const status = error.code === 'provider_unavailable' ? 503 : 502
      return failure(error.code, error.message, status, { usage, headers, hint: error.hint })
    }
    if (error instanceof InputError) {
      return failure(error.code, error.message, 400, { usage, headers, hint: error.hint })
    }
    console.error('[api/extract] unexpected error:', error)
    return failure('provider_error', 'Something went wrong while processing the image. Please try again.', 500, { usage, headers })
  } finally {
    // The privacy promise, made explicit: drop the only reference we hold.
    buffer = null
  }
}
