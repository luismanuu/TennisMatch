// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { PGlite } from '@electric-sql/pglite'
import type { Db } from '../../server/db'
import { consumeRateLimit, MAX_RATE_LIMIT_WINDOW_SECONDS, pruneRateLimitBuckets } from '../../server/utils/rate-limit'
import { createTestDb } from '../db/pglite'

// Differential: the SQL upsert against PGlite versus a plain fixed-window model of the same rule.
// Both use the caller's clock, so time can be advanced, repeated or moved backwards (skewed instances).

let client: PGlite
let db: Db
let run = 0

beforeAll(async () => {
  ;({ client, db } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await client?.close()
})

type Bucket = { count: number; start: number }

function model(buckets: Map<string, Bucket>, key: string, windowSeconds: number, max: number, now: number) {
  const b = buckets.get(key)
  const next = !b || b.start <= now - windowSeconds * 1000 ? { count: 1, start: now } : { count: b.count + 1, start: b.start }
  buckets.set(key, next)
  const allowed = next.count <= max
  return {
    allowed,
    count: next.count,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((next.start + windowSeconds * 1000 - now) / 1000)),
  }
}

const KEYS = ['invite:inviter:1', 'invite:email:ana@tenis.ec', 'invite:email:ÑANDÚ@tenis.ec', '', 'x|/sign-in']

const ruleArb = fc.record({ windowSeconds: fc.integer({ min: 1, max: 3600 }), max: fc.integer({ min: 1, max: 6 }) })
const stepArb = (window: number) =>
  fc.record({
    key: fc.constantFrom(...KEYS),
    // Same instant, just inside / at / past the window edge, far ahead, and backwards (clock skew)
    dtMs: fc.oneof(
      fc.constant(0),
      fc.integer({ min: 1, max: 999 }),
      fc.constantFrom(window * 1000 - 1, window * 1000, window * 1000 + 1),
      fc.integer({ min: 0, max: window * 3000 }),
      fc.integer({ min: -window * 1000, max: -1 }),
    ),
  })

describe('consumeRateLimit (property, real SQL on PGlite)', () => {
  it('matches the fixed-window model for any interleaving of keys and clock movements', async () => {
    await fc.assert(
      fc.asyncProperty(
        ruleArb.chain((rule) => fc.tuple(fc.constant(rule), fc.array(stepArb(rule.windowSeconds), { minLength: 1, maxLength: 25 }))),
        async ([rule, steps]) => {
          const prefix = `run${++run}:`
          const buckets = new Map<string, Bucket>()
          let now = Date.UTC(2026, 8, 25, 12, 0, 0)
          for (const step of steps) {
            now += step.dtMs
            const got = await consumeRateLimit(db, prefix + step.key, rule, new Date(now))
            const want = model(buckets, prefix + step.key, rule.windowSeconds, rule.max, now)
            expect(got).toEqual(want)
          }
        },
      ),
      { seed: 20260925, numRuns: 150 },
    )
  }, 120_000)

  it('never allows more than max per key within one window, however the calls are spaced', async () => {
    await fc.assert(
      fc.asyncProperty(ruleArb, fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 30 }), async (rule, gaps) => {
        const key = `burst${++run}`
        let now = Date.UTC(2026, 8, 25, 12, 0, 0)
        const allowedAt: number[] = []
        for (const gap of gaps) {
          now += gap
          if ((await consumeRateLimit(db, key, rule, new Date(now))).allowed) allowedAt.push(now)
        }
        // Fixed windows: every allowed call inside [start, start + window) shares one window start.
        for (const t of allowedAt) {
          const inWindow = allowedAt.filter((u) => u >= t && u < t + rule.windowSeconds * 1000)
          expect(inWindow.length).toBeLessThanOrEqual(2 * rule.max) // fixed-window boundary burst bound
        }
        return true
      }),
      { seed: 20260925, numRuns: 100 },
    )
  }, 120_000)

  it('rejects rules it cannot honour instead of silently allowing everything', async () => {
    for (const rule of [
      { windowSeconds: 0, max: 1 },
      { windowSeconds: -5, max: 1 },
      { windowSeconds: MAX_RATE_LIMIT_WINDOW_SECONDS + 1, max: 1 },
      { windowSeconds: 60, max: 0 },
      { windowSeconds: Number.NaN, max: 1 },
      { windowSeconds: 60, max: Number.NaN },
    ]) {
      await expect(consumeRateLimit(db, 'bad-rule', rule)).rejects.toThrow(/Invalid rate limit rule/)
    }
  })

  it('pruning drops only buckets older than the longest allowed window', async () => {
    const now = new Date(Date.UTC(2026, 8, 25, 12))
    const old = new Date(now.getTime() - (MAX_RATE_LIMIT_WINDOW_SECONDS + 1) * 1000)
    const recent = new Date(now.getTime() - (MAX_RATE_LIMIT_WINDOW_SECONDS - 1) * 1000)
    await consumeRateLimit(db, 'prune:old', { windowSeconds: 60, max: 1 }, old)
    await consumeRateLimit(db, 'prune:recent', { windowSeconds: 60, max: 1 }, recent)
    await pruneRateLimitBuckets(db, now)
    const { rows } = await client.query<{ key: string }>(`select key from rate_limit_buckets where key like 'prune:%' order by key`)
    expect(rows.map((r) => r.key)).toEqual(['prune:recent'])
  })
})
