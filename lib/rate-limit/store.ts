export interface UsageStore {
  kind: 'memory' | 'redis'
  /** Atomically add 1 and return the new count. Sets `ttlSeconds` on first hit. */
  increment(key: string, ttlSeconds: number): Promise<number>
  /** Give a credit back when a conversion fails after being counted. */
  decrement(key: string): Promise<void>
  get(key: string): Promise<number>
}

/**
 * Per-process counter. Honest limitation: serverless functions are stateless,
 * so this only limits *per instance*. Good enough for dev and low-traffic MVP;
 * production should set UPSTASH_REDIS_REST_URL/TOKEN (see .env.example).
 */
export class MemoryUsageStore implements UsageStore {
  kind = 'memory' as const
  private counts = new Map<string, { count: number; expiresAt: number }>()

  async increment(key: string, ttlSeconds: number): Promise<number> {
    this.sweep()
    const now = Date.now()
    const entry = this.counts.get(key)
    if (!entry || entry.expiresAt < now) {
      this.counts.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 })
      return 1
    }
    entry.count += 1
    return entry.count
  }

  async decrement(key: string): Promise<void> {
    const entry = this.counts.get(key)
    if (entry && entry.expiresAt > Date.now()) entry.count = Math.max(0, entry.count - 1)
  }

  async get(key: string): Promise<number> {
    const entry = this.counts.get(key)
    if (!entry || entry.expiresAt < Date.now()) return 0
    return entry.count
  }

  private sweep(): void {
    if (this.counts.size < 500) return
    const now = Date.now()
    for (const [key, entry] of this.counts) {
      if (entry.expiresAt < now) this.counts.delete(key)
    }
  }
}

export class UpstashUsageStore implements UsageStore {
  kind = 'redis' as const
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Upstash responded ${response.status}: ${await response.text()}`)
    }
    const payload = (await response.json()) as { result?: unknown; error?: string }[]
    const firstError = payload.find((entry) => entry?.error)?.error
    if (firstError) throw new Error(`Upstash pipeline error: ${firstError}`)
    return payload.map((entry) => entry?.result)
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const [count] = (await this.pipeline([['INCR', key]])) as number[]
    if (count === 1) {
      await this.pipeline([['EXPIRE', key, ttlSeconds]])
    }
    return count
  }

  async decrement(key: string): Promise<void> {
    await this.pipeline([['DECR', key]])
  }

  async get(key: string): Promise<number> {
    const [value] = (await this.pipeline([['GET', key]])) as (string | null)[]
    return Number.parseInt(value ?? '0', 10) || 0
  }
}

let store: UsageStore | null = null

export function getUsageStore(config: { redis: { configured: boolean; url: string | null; token: string | null } }): UsageStore {
  if (store) return store
  if (config.redis.configured && config.redis.url && config.redis.token) {
    store = new UpstashUsageStore(config.redis.url, config.redis.token)
  } else {
    store = new MemoryUsageStore()
  }
  return store
}
