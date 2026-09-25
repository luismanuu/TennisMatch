import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, setResponseHeader } from 'h3'
import type { DbOrTx } from '../db'

// Fixed-window rate limiting stored in Postgres (rate_limit_buckets). Serverless instances share no
// memory, so an in-process counter would reset on every cold start and differ per instance.
//
// One upsert per check: Postgres serialises concurrent upserts on the same key, so two requests can
// never both read a stale count. Every call counts, allowed or not; a denied caller does not extend
// its own window, so it can retry once the window has elapsed.

export type RateLimitRule = { windowSeconds: number; max: number }
export type RateLimitDecision = { allowed: boolean; count: number; retryAfterSeconds: number }

// Buckets older than this are deleted opportunistically. Rules may not use a longer window.
export const MAX_RATE_LIMIT_WINDOW_SECONDS = 7 * 24 * 60 * 60

export async function consumeRateLimit(
  db: DbOrTx,
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  if (!(rule.windowSeconds > 0 && rule.windowSeconds <= MAX_RATE_LIMIT_WINDOW_SECONDS) || !(rule.max >= 1)) {
    throw new Error(`Invalid rate limit rule for ${key}`)
  }
  const nowIso = now.toISOString()
  const expired = sql`rate_limit_buckets.window_started_at <= ${nowIso}::timestamptz - make_interval(secs => ${rule.windowSeconds})`
  const result = await db.execute(sql`
    insert into rate_limit_buckets (key, count, window_started_at)
    values (${key}, 1, ${nowIso}::timestamptz)
    on conflict (key) do update set
      count = case when ${expired} then 1 else rate_limit_buckets.count + 1 end,
      window_started_at = case when ${expired} then excluded.window_started_at else rate_limit_buckets.window_started_at end
    returning count, window_started_at
  `)
  const row = rowsOf(result)[0] as { count: number | string; window_started_at: string | Date }
  const count = Number(row.count)
  const windowEnd = new Date(row.window_started_at).getTime() + rule.windowSeconds * 1000
  const allowed = count <= rule.max
  return {
    allowed,
    count,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
  }
}

// Throws a 429 with Retry-After when any of the rules is exhausted. Every rule is consumed, so a caller
// hitting one limit still spends from the others.
export async function enforceRateLimits(
  event: H3Event,
  db: DbOrTx,
  checks: Array<{ key: string; rule: RateLimitRule; message: string }>,
  now: Date = new Date(),
): Promise<void> {
  let denied: { retryAfterSeconds: number; message: string } | undefined
  for (const check of checks) {
    const decision = await consumeRateLimit(db, check.key, check.rule, now)
    if (!decision.allowed && (!denied || decision.retryAfterSeconds > denied.retryAfterSeconds)) {
      denied = { retryAfterSeconds: decision.retryAfterSeconds, message: check.message }
    }
  }
  await pruneRateLimitBuckets(db, now)
  if (denied) {
    setResponseHeader(event, 'Retry-After', denied.retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: denied.message })
  }
}

export async function pruneRateLimitBuckets(db: DbOrTx, now: Date = new Date()): Promise<void> {
  await db.execute(sql`
    delete from rate_limit_buckets
    where window_started_at < ${now.toISOString()}::timestamptz - make_interval(secs => ${MAX_RATE_LIMIT_WINDOW_SECONDS})
  `)
}

// neon-serverless returns { rows }, PGlite returns { rows } as well; keep one accessor for both.
function rowsOf(result: unknown): unknown[] {
  return (result as { rows: unknown[] }).rows
}
