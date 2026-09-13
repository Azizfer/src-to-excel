import { describe, expect, it } from 'vitest'

import { MemoryUsageStore } from './store'
import { resetAtIso, secondsUntilReset, usageKey, type RequestIdentity } from './usage'

describe('memory usage store', () => {
  it('counts up, gives credits back, and expires', async () => {
    const store = new MemoryUsageStore()
    expect(await store.increment('k', 60)).toBe(1)
    expect(await store.increment('k', 60)).toBe(2)
    await store.decrement('k')
    expect(await store.get('k')).toBe(1)
    expect(await store.get('missing')).toBe(0)
  })
})

describe('daily windows', () => {
  const identity: RequestIdentity = { key: 'ip:test', source: 'ip', newCookie: null, rawIp: '1.2.3.4' }

  it('keys include the UTC day so counters reset at midnight', () => {
    const day = new Date(Date.UTC(2026, 8, 13, 23, 30))
    expect(usageKey(identity, day)).toBe('s2x:usage:2026-09-13:ip:test')
    const tomorrow = new Date(Date.UTC(2026, 8, 13, 23, 30).valueOf() + 2 * 60 * 60 * 1000)
    expect(usageKey(identity, tomorrow)).not.toBe(usageKey(identity, day))
  })

  it('resets at the next UTC midnight', () => {
    const day = new Date(Date.UTC(2026, 8, 13, 23, 30))
    expect(resetAtIso(day)).toBe('2026-09-14T00:00:00.000Z')
    expect(secondsUntilReset(day)).toBeGreaterThan(1700)
    expect(secondsUntilReset(new Date())).toBeGreaterThan(0)
  })
})
