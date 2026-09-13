import { createHash, randomUUID } from 'node:crypto'

import { USAGE_COOKIE } from '../constants'
import type { AppConfig } from '../env'
import type { UsageInfo } from '../types'
import { getUsageStore } from './store'

export interface RequestIdentity {
  key: string
  source: 'ip' | 'cookie' | 'anonymous'
  /** Set when we minted a cookie the response should persist. */
  newCookie: string | null
  rawIp: string | null
}

const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0$|::1$|fc|fd|fe80:)/i

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 20)
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/**
 * Free-tier identity, per the plan: IP-based with a cookie fallback for
 * localhost / CGNAT situations where many humans share one address.
 * The raw IP never leaves the server — only a salted hash is used as a key.
 */
export function resolveIdentity(request: Request): RequestIdentity {
  const forwarded = request.headers.get('x-forwarded-for')
  const rawIp = (forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? '').trim() || null
  const cookie = readCookie(request.headers.get('cookie'), USAGE_COOKIE)

  if (rawIp && !PRIVATE_IP.test(rawIp)) {
    return { key: `ip:${shortHash(rawIp)}`, source: 'ip', newCookie: cookie ? null : randomUUID(), rawIp }
  }
  const id = cookie ?? randomUUID()
  return {
    key: `ck:${shortHash(id)}`,
    source: cookie ? 'cookie' : 'anonymous',
    newCookie: cookie ? null : id,
    rawIp,
  }
}

export function cookieHeaderFor(identity: RequestIdentity, request: Request): string | null {
  if (!identity.newCookie) return null
  const secure = new URL(request.url).protocol === 'https:'
  return `${USAGE_COOKIE}=${identity.newCookie}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`
}

export function usageKey(identity: RequestIdentity, date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return `s2x:usage:${day}:${identity.key}`
}

export function resetAtIso(date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  return next.toISOString()
}

export function secondsUntilReset(date = new Date()): number {
  return Math.max(60, Math.floor((new Date(resetAtIso(date)).getTime() - date.getTime()) / 1000) + 60)
}

export function isAllowlisted(identity: RequestIdentity, config: AppConfig): boolean {
  return Boolean(identity.rawIp && config.rateLimitAllowlist.includes(identity.rawIp))
}

function snapshot(used: number, config: AppConfig, limited: boolean): UsageInfo {
  return {
    used,
    limit: config.freeDailyLimit,
    remaining: Math.max(0, config.freeDailyLimit - used),
    resetAt: resetAtIso(),
    limited,
  }
}

export async function peekUsage(config: AppConfig, identity: RequestIdentity): Promise<UsageInfo> {
  if (isAllowlisted(identity, config)) return snapshot(0, config, false)
  const store = getUsageStore(config)
  const used = await store.get(usageKey(identity))
  return snapshot(used, config, used >= config.freeDailyLimit)
}

/** Counts the conversion *before* the expensive work; call releaseUsage() on failure. */
export async function consumeUsage(
  config: AppConfig,
  identity: RequestIdentity,
): Promise<{ allowed: boolean; usage: UsageInfo }> {
  if (isAllowlisted(identity, config)) return { allowed: true, usage: snapshot(0, config, false) }
  const store = getUsageStore(config)
  const used = await store.increment(usageKey(identity), secondsUntilReset())
  return { allowed: used <= config.freeDailyLimit, usage: snapshot(used, config, used > config.freeDailyLimit) }
}

export async function releaseUsage(config: AppConfig, identity: RequestIdentity): Promise<void> {
  if (isAllowlisted(identity, config)) return
  const store = getUsageStore(config)
  await store.decrement(usageKey(identity))
}
