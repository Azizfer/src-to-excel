import { FREE_DAILY_LIMIT, MAX_UPLOAD_BYTES } from './constants'

export type ProviderSetting = 'auto' | 'textract' | 'local'

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export interface AppConfig {
  provider: ProviderSetting
  freeDailyLimit: number
  maxUploadBytes: number
  rateLimitAllowlist: string[]
  aws: {
    configured: boolean
    region: string
    hasCredentials: boolean
  }
  localOcr: {
    langs: string[]
    langPath: string | null
  }
  redis: { configured: boolean; url: string | null; token: string | null }
  siteUrl: string
}

/**
 * Single place that reads `process.env` for the extraction pipeline.
 * Server-only: never import this from a client component.
 */
export function getConfig(): AppConfig {
  const env = process.env
  const providerSetting = (env.EXTRACTION_PROVIDER ?? 'auto').toLowerCase()
  const provider: ProviderSetting =
    providerSetting === 'textract' || providerSetting === 'local' ? providerSetting : 'auto'

  const hasCredentials = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY)
  const redisUrl = env.UPSTASH_REDIS_REST_URL ?? null
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN ?? null

  return {
    provider,
    freeDailyLimit: int(env.FREE_DAILY_LIMIT, FREE_DAILY_LIMIT),
    maxUploadBytes: int(env.MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES),
    rateLimitAllowlist: list(env.RATE_LIMIT_ALLOWLIST),
    aws: {
      configured: hasCredentials,
      region: env.AWS_REGION || 'us-east-1',
      hasCredentials,
    },
    localOcr: {
      langs: list(env.LOCAL_OCR_LANGS).length ? list(env.LOCAL_OCR_LANGS) : ['eng'],
      langPath: env.LOCAL_OCR_LANG_PATH || null,
    },
    redis: { configured: Boolean(redisUrl && redisToken), url: redisUrl, token: redisToken },
    siteUrl: env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  }
}

/** Which provider `auto` would pick right now — surfaced by /api/health and the UI. */
export function resolveAutoProvider(config: AppConfig): 'textract' | 'local' {
  if (config.provider === 'textract') return 'textract'
  if (config.provider === 'local') return 'local'
  return config.aws.configured ? 'textract' : 'local'
}
