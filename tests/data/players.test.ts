// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'

let app: TestApp
let categoryId: string
let categoryName: string
let categoryDefaultElo: number
let cityId: string
let cityName: string

beforeAll(async () => {
  app = await startTestApp()
  const categoriesRes = await app.request('GET', '/api/categories')
  const citiesRes = await app.request('GET', '/api/cities')
  const category = (categoriesRes.body as Array<{ id: string; name: string; default_elo: number }>)[0]
  const city = (citiesRes.body as Array<{ id: string; name: string }>)[0]
  categoryId = category.id
  categoryName = category.name
  categoryDefaultElo = category.default_elo
  cityId = city.id
  cityName = city.name
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe('onboarding: POST/GET /api/players/me', () => {
  it('sign up -> 404 -> create -> get returns the shaped player; a second POST does not duplicate', async () => {
    const account = await app.signUp('onboarding@tenis.ec')

    const before = await app.request('GET', '/api/players/me', { cookie: account.cookie })
    expect(before.status).toBe(404)

    const created = await app.request('POST', '/api/players/me', {
      cookie: account.cookie,
      body: { name: 'Ana Ejemplo', city_id: cityId, category_id: categoryId },
    })
    expect(created.status).toBe(200)

    const after = await app.request('GET', '/api/players/me', { cookie: account.cookie })
    expect(after.status).toBe(200)
    const player = after.body as { category: { name: string }; city: { name: string }; elo: number }
    expect(player.category.name).toBe(categoryName)
    expect(player.city.name).toBe(cityName)
    expect(player.elo).toBe(categoryDefaultElo)

    const secondPost = await app.request('POST', '/api/players/me', {
      cookie: account.cookie,
      body: { name: 'Ana Otra Vez', city_id: cityId, category_id: categoryId },
    })
    expect(secondPost.status).toBe(409)

    const rows = await app.client.query<{ n: number }>(`select count(*)::int as n from players where user_id = $1`, [
      account.userId,
    ])
    expect(rows.rows[0].n).toBe(1)
  })

  // Regression: this harness serializes the two POSTs below (single PGlite connection, no real
  // network latency), so in practice this exercises the ordinary SELECT-then-409 guard, not the
  // DB-unique-constraint fallback a true cross-connection race would hit. The fallback path was
  // found by sabotaging the SELECT guard directly (`if (existingPlayer)` -> `if (false && ...)`
  // in me.post.ts): the resulting duplicate INSERT threw a 500, not 409, because the catch block
  // checked `error.code` but drizzle/h3 puts the pg error code on `error.cause.code` here. Fixed
  // by checking `error?.code ?? error?.cause?.code`. Kept as a concurrency smoke test; it does
  // NOT by itself prove the cause.code fallback (see report — could not force that race here).
  it('regression: two concurrent POSTs for the same account create exactly one player and the loser gets 409', async () => {
    const account = await app.signUp('race@tenis.ec')

    const [first, second] = await Promise.all([
      app.request('POST', '/api/players/me', {
        cookie: account.cookie,
        body: { name: 'Carrera Uno', city_id: cityId, category_id: categoryId },
      }),
      app.request('POST', '/api/players/me', {
        cookie: account.cookie,
        body: { name: 'Carrera Dos', city_id: cityId, category_id: categoryId },
      }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])

    const rows = await app.client.query<{ n: number }>(`select count(*)::int as n from players where user_id = $1`, [
      account.userId,
    ])
    expect(rows.rows[0].n).toBe(1)
  })
})

describe('IDOR: PUT /api/players/[id]', () => {
  it("A's session on B's player id -> 403, and B is unchanged", async () => {
    const a = await app.signUp('idor-a@tenis.ec')
    const b = await app.signUp('idor-b@tenis.ec')

    await app.request('POST', '/api/players/me', {
      cookie: a.cookie,
      body: { name: 'Jugador A', city_id: cityId, category_id: categoryId },
    })
    const bCreated = await app.request('POST', '/api/players/me', {
      cookie: b.cookie,
      body: { name: 'Jugador B Original', city_id: cityId, category_id: categoryId },
    })
    const bPlayer = bCreated.body as { id: string }

    const attack = await app.request('PUT', `/api/players/${bPlayer.id}`, {
      cookie: a.cookie,
      body: { name: 'Hackeado' },
    })
    expect(attack.status).toBe(403)

    const check = await app.request('GET', `/api/players/${bPlayer.id}`)
    expect((check.body as { name: string }).name).toBe('Jugador B Original')
  })

  it('an id that does not exist -> 404 (not 403 — no player to leak ownership of)', async () => {
    const a = await app.signUp('idor-a2@tenis.ec')
    const res = await app.request('PUT', '/api/players/00000000-0000-4000-8000-000000000099', {
      cookie: a.cookie,
      body: { name: 'x' },
    })
    expect(res.status).toBe(404)
  })
})

// Fresh, isolated app: every iteration wipes players/user rows it inserted directly by SQL,
// so the property never has to reason about state left over from another run or another test.
const SAFE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚáéíóúñÑüÜçÇ '-".split('')
const charsArb = (min: number, max: number) =>
  fc.array(fc.constantFrom(...SAFE_CHARS), { minLength: min, maxLength: max }).map((chars) => chars.join(''))
const nameArb = fc.oneof(
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 1, arbitrary: fc.constant('   ') },
  { weight: 6, arbitrary: charsArb(1, 12) },
)
const queryArb = charsArb(0, 6)

describe('players/search (property)', () => {
  let searchApp: TestApp
  let seq = 0

  beforeAll(async () => {
    searchApp = await startTestApp()
  }, 60_000)

  afterAll(async () => {
    await searchApp?.close()
  })

  async function seed(specs: Array<{ name: string; deleted: boolean }>) {
    await searchApp.client.query('delete from players')
    await searchApp.client.query('delete from "user"')
    for (const spec of specs) {
      seq++
      const userId = `search-prop-user-${seq}`
      const email = `search-prop-${seq}@t.ec`
      await searchApp.client.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [userId, 'x', email])
      await searchApp.client.query(`insert into players (user_id, name, status) values ($1, $2, $3)`, [
        userId,
        spec.name,
        spec.deleted ? 'deleted' : 'active',
      ])
    }
  }

  async function checkQuery(specs: Array<{ name: string; deleted: boolean }>, rawQuery: string) {
    const res = await searchApp.request('GET', '/api/players/search', { query: { q: rawQuery } })
    expect(res.status).toBe(200)
    const got = (res.body as Array<{ name: string }>).map((p) => p.name).sort()

    const trimmed = rawQuery.trim()
    if (trimmed.length < 2) {
      expect(got).toEqual([])
      return
    }

    const needle = trimmed.toLowerCase()
    const expected = specs
      .filter((s) => !s.deleted && s.name.toLowerCase().includes(needle))
      .map((s) => s.name)
      .sort()
    expect(got).toEqual(expected)
  }

  it('returns exactly the active players whose name matches case-insensitively, never a soft-deleted one', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ name: nameArb, deleted: fc.boolean() }), { minLength: 0, maxLength: 6 }),
        queryArb,
        fc.nat(),
        fc.nat(),
        fc.nat(),
        async (specs, rawQuery, pickSeed, startSeed, lenSeed) => {
          await seed(specs)

          // A purely random query rarely lands inside a purely random name, so most runs would
          // trivially check "no matches -> empty result" and never exercise the active/deleted
          // split at all. Also check a query that IS a substring of one of the seeded names
          // (active or deleted, picked by the fc-controlled seeds below), which is guaranteed to
          // produce at least one real match whenever a candidate exists — that's what actually
          // exercises "matches case-insensitively, never a soft-deleted one".
          await checkQuery(specs, rawQuery)

          const candidates = specs.map((s) => s.name).filter((n) => n.trim().length > 0)
          if (candidates.length > 0) {
            const name = candidates[pickSeed % candidates.length]
            const start = startSeed % name.length
            const len = 1 + (lenSeed % (name.length - start))
            const targeted = name.slice(start, start + len)
            await checkQuery(specs, targeted)
          }
        },
      ),
      { seed: 20260925, numRuns: 15 },
    )
  })
})
