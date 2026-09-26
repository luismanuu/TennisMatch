// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { ELO_DECAY_FLOOR } from '../../server/utils/rating-system'

// Monthly decay writes ratings. It must only happen from the scheduled job, which proves itself with
// CRON_SECRET, at most once per player per calendar month. The public decay-status GET only reads.

const CRON_PATH = '/api/cron/monthly-decay'
const TEST_CRON_SECRET = 'test-cron-secret-0123456789abcdef'

let app: TestApp
let categoryId: string
let stranger: { cookie: string }
let admin: { cookie: string }

type Row = {
  id: string
  elo: number
  mmr_uncertainty: number
  matches_this_month: number
  last_decay_check: string | null
  total_matches_played: number
  placement_matches_completed: number
  status: string
}

const now = new Date()
const ymd = (d: Date) => d.toISOString().split('T')[0]
const today = ymd(now)
const midLastMonth = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)))
const midThisMonth = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)))

beforeAll(async () => {
  app = await startTestApp()
  const [c] = (
    await app.client.query<{ id: string }>(`insert into categories (name, "order", default_elo) values ('Decaimiento', 9, 1500) returning id`)
  ).rows
  categoryId = c.id
  stranger = await app.signUp('curioso@tenis.ec')
  admin = await app.signUp('admin.decay@tenis.ec', 'admin')
}, 120_000)

afterAll(async () => {
  delete process.env.CRON_SECRET
  await app?.close()
})

beforeEach(() => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
})

type PlayerSpec = {
  elo: number
  uncertainty: number
  matchesThisMonth: number
  lastCheck: string | null
  total: number
  placement: number
  deleted: boolean
  oldAccount: boolean
}

const playerSpec: fc.Arbitrary<PlayerSpec> = fc.record({
  elo: fc.integer({ min: 700, max: 2600 }),
  uncertainty: fc.constantFrom(0.5, 1, 1.5, 1.95, 2),
  matchesThisMonth: fc.nat({ max: 4 }),
  lastCheck: fc.constantFrom(null, midLastMonth, midThisMonth, '2025-01-15'),
  total: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 40 })),
  placement: fc.nat({ max: 3 }),
  deleted: fc.boolean(),
  oldAccount: fc.boolean(),
})

// Players that are due and eligible, the shape the unauthenticated GET used to decay.
const eligibleSpec: fc.Arbitrary<PlayerSpec> = fc.record({
  elo: fc.integer({ min: 900, max: 2600 }),
  uncertainty: fc.constantFrom(0.5, 1, 1.5),
  matchesThisMonth: fc.nat({ max: 1 }),
  lastCheck: fc.constant(midLastMonth),
  total: fc.integer({ min: 3, max: 40 }),
  placement: fc.constant(3),
  deleted: fc.constant(false),
  oldAccount: fc.constant(true),
})

async function insertPlayer(spec: PlayerSpec): Promise<string> {
  const userId = randomUUID()
  await app.client.query(`insert into "user" (id, name, email) values ($1, 'decay', $2)`, [userId, `${userId}@decay.ec`])
  const { rows } = await app.client.query<{ id: string }>(
    `insert into players (user_id, name, category_id, elo, mmr_uncertainty, matches_this_month, last_decay_check,
       total_matches_played, placement_matches_completed, status, deleted_at, created_at)
     values ($1, 'Jugador decaimiento', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [
      userId,
      categoryId,
      spec.elo,
      spec.uncertainty,
      spec.matchesThisMonth,
      spec.lastCheck,
      spec.total,
      spec.placement,
      spec.deleted ? 'deleted' : 'active',
      spec.deleted ? new Date() : null,
      spec.oldAccount ? '2025-01-10T12:00:00Z' : new Date(),
    ],
  )
  return rows[0].id
}

async function snapshot(ids: string[]): Promise<Map<string, Row>> {
  const { rows } = await app.client.query<Row>(
    `select id, elo, mmr_uncertainty::float8 as mmr_uncertainty, matches_this_month, last_decay_check::text as last_decay_check,
            total_matches_played, placement_matches_completed, status
       from players where id = any($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

const cron = (authorization?: string, cookie?: string) =>
  app.request('GET', CRON_PATH, { cookie, headers: authorization === undefined ? {} : { authorization } })

describe('GET /api/players/:id/decay-status is read-only', () => {
  // Audit 2026-09-26, finding 2: decay-status.get.ts:8-42 called checkAndApplyMonthlyDecay for anyone who
  // added ?apply_decay=true, writing elo, mmr_uncertainty and matches_this_month without a session.
  it('regression: anonymous ?apply_decay=true on a due player no longer lowers their elo', async () => {
    const id = await insertPlayer({
      elo: 1800,
      uncertainty: 1,
      matchesThisMonth: 0,
      lastCheck: midLastMonth,
      total: 12,
      placement: 3,
      deleted: false,
      oldAccount: true,
    })
    const before = await snapshot([id])
    const res = await app.request('GET', `/api/players/${id}/decay-status`, { query: { apply_decay: 'true' } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, decay_applied: 0, status: { will_decay: true } })
    expect(await snapshot([id])).toEqual(before)
  })

  it('no caller and no query changes the row (property over due players)', async () => {
    const callers = [undefined, () => stranger.cookie, () => admin.cookie]
    await fc.assert(
      fc.asyncProperty(
        eligibleSpec,
        fc.constantFrom(...callers),
        fc.constantFrom({ apply_decay: 'true' }, { apply_decay: '1' }, { apply_decay: 'TRUE' }, {}),
        async (spec, caller, query) => {
          const id = await insertPlayer(spec)
          const before = await snapshot([id])
          const res = await app.request('GET', `/api/players/${id}/decay-status`, { cookie: caller?.(), query })
          if (res.status !== 200) return false
          expect(await snapshot([id])).toEqual(before)
          return true
        },
      ),
      { seed: 20260926, numRuns: 40 },
    )
  }, 120_000)
})

describe('the decay cron authenticates with CRON_SECRET only', () => {
  let due: string
  let before: Map<string, Row>

  beforeEach(async () => {
    due = await insertPlayer({
      elo: 2000,
      uncertainty: 1,
      matchesThisMonth: 0,
      lastCheck: midLastMonth,
      total: 20,
      placement: 3,
      deleted: false,
      oldAccount: true,
    })
    before = await snapshot([due])
  })

  const refusals: Array<[string, () => Promise<{ status: number }>]> = [
    ['no Authorization header', () => cron()],
    ['the secret without the Bearer scheme', () => cron(TEST_CRON_SECRET)],
    ['a wrong secret', () => cron('Bearer not-the-secret')],
    ['the secret with a trailing character', () => cron(`Bearer ${TEST_CRON_SECRET}x`)],
    ['an admin session and no secret', () => cron(undefined, admin.cookie)],
  ]

  it.each(refusals)('%s → 401 and no write', async (_, call) => {
    expect((await call()).status).toBe(401)
    expect(await snapshot([due])).toEqual(before)
  })

  it('refuses everything when CRON_SECRET is not configured, including "Bearer undefined" and "Bearer "', async () => {
    delete process.env.CRON_SECRET
    for (const header of [undefined, 'Bearer undefined', 'Bearer ', 'Bearer', '']) {
      expect((await cron(header)).status).toBe(401)
    }
    process.env.CRON_SECRET = ''
    expect((await cron('Bearer ')).status).toBe(401)
    expect(await snapshot([due])).toEqual(before)
  })

  it('refuses any other Authorization value (property)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 60 }), async (header) => {
        fc.pre(header !== `Bearer ${TEST_CRON_SECRET}`)
        const res = await cron(header)
        return res.status === 401
      }),
      { seed: 20260926, numRuns: 60 },
    )
    expect(await snapshot([due])).toEqual(before)
  }, 120_000)

  it('with the secret it runs and decays the due player', async () => {
    const res = await cron(`Bearer ${TEST_CRON_SECRET}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const after = (await snapshot([due])).get(due)!
    expect(after.elo).toBeLessThan(before.get(due)!.elo)
    expect(after.last_decay_check).toBe(today)
  })
})

describe('the decay cron: once per player per month, only for eligible players', () => {
  it('property: exempt players are untouched, due players decay once, a second run changes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(playerSpec, { minLength: 1, maxLength: 12 }), async (specs) => {
        const ids: string[] = []
        for (const spec of specs) ids.push(await insertPlayer(spec))
        const before = await snapshot(ids)

        const first = await cron(`Bearer ${TEST_CRON_SECRET}`)
        expect(first.status, JSON.stringify(first.body)).toBe(200)
        const afterFirst = await snapshot(ids)

        specs.forEach((spec, i) => {
          const b = before.get(ids[i])!
          const a = afterFirst.get(ids[i])!
          const exempt = spec.deleted || spec.total === 0 || spec.placement < 3
          const checkedThisMonth = spec.lastCheck === midThisMonth
          if (exempt || checkedThisMonth) {
            expect(a, JSON.stringify(spec)).toEqual(b)
            return
          }
          expect(a.last_decay_check, JSON.stringify(spec)).toBe(today)
          if (spec.lastCheck === null) {
            // First sighting: record the month, decay nothing, keep the running count.
            expect(a, JSON.stringify(spec)).toEqual({ ...b, last_decay_check: today })
            return
          }
          expect(a.matches_this_month).toBe(0)
          expect(a.elo).toBeLessThanOrEqual(b.elo)
          expect(a.elo).toBeGreaterThanOrEqual(Math.min(b.elo, ELO_DECAY_FLOOR))
          expect(a.mmr_uncertainty).toBeGreaterThanOrEqual(b.mmr_uncertainty)
          expect(a.mmr_uncertainty).toBeLessThanOrEqual(2)
          if (spec.matchesThisMonth >= 2) expect(a.elo, JSON.stringify(spec)).toBe(b.elo)
          if (spec.oldAccount && spec.matchesThisMonth < 2 && b.elo > ELO_DECAY_FLOOR) expect(a.elo, JSON.stringify(spec)).toBeLessThan(b.elo)
        })

        const second = await cron(`Bearer ${TEST_CRON_SECRET}`)
        expect(second.status).toBe(200)
        expect(await snapshot(ids)).toEqual(afterFirst)
        return true
      }),
      { seed: 20260926, numRuns: 25 },
    )
  }, 120_000)
})
