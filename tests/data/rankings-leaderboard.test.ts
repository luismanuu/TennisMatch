// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { deletePlayers, seedPlayer, seedPlayers, type PlayerSpec } from './rankings-helpers'

let app: TestApp

beforeAll(async () => {
  app = await startTestApp()
}, 120_000)

afterAll(async () => {
  await app?.close()
})

const specArb = fc.record({
  elo: fc.integer({ min: 1, max: 4500 }),
  total_matches_played: fc.integer({ min: 0, max: 200 }),
  deleted: fc.boolean(),
})

type Spec = { elo: number; total_matches_played: number; deleted: boolean }

/** Fetches every page of /api/leaderboard with a small page size, concatenating the results. */
async function fetchAllPages(app: TestApp, pageSize: number) {
  const pages: Array<{ status: number; body: any }> = []
  let offset = 0
  for (let guard = 0; guard < 50; guard++) {
    const res = await app.request('GET', '/api/leaderboard', { query: { limit: String(pageSize), offset: String(offset) } })
    pages.push(res)
    const body = res.body as { rankings: Array<{ id: string }>; total: number }
    if (body.rankings.length === 0) break
    offset += pageSize
    if (offset >= (body.total ?? 0)) break
  }
  return pages
}

describe('GET /api/leaderboard: population, ranking and pagination (property)', () => {
  it('ranks exactly the active/not-deleted population by elo desc with a stable tie-break, gapless ranks 1..n, pages partition it, and soft-deleted players never appear', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(specArb, { minLength: 3, maxLength: 12 }), async (specs: Spec[]) => {
        const ids: string[] = []
        try {
          for (const spec of specs) {
            const id = await seedPlayer(app, {
              elo: spec.elo,
              total_matches_played: spec.total_matches_played,
              status: spec.deleted ? 'deleted' : 'active',
              deleted_at: spec.deleted ? new Date() : null,
            })
            ids.push(id)
          }

          // Expected population: active, not deleted. No min-matches rule on this route.
          const expected = specs
            .map((s, i) => ({ id: ids[i], elo: s.elo, deleted: s.deleted }))
            .filter((p) => !p.deleted)
            .sort((a, b) => (b.elo !== a.elo ? b.elo - a.elo : a.id.localeCompare(b.id)))

          const pages = await fetchAllPages(app, 3)
          for (const p of pages) if (p.status !== 200) return false

          const all = pages.flatMap((p) => (p.body as { rankings: Array<{ id: string; elo: number; rank: number }> }).rankings)

          // No dupes, no omissions, no soft-deleted player, exact same population.
          const deletedIds = new Set(ids.filter((_, i) => specs[i].deleted))
          if (all.some((r) => deletedIds.has(r.id))) return false
          if (all.length !== expected.length) return false

          // Order + stable tie-break, and gapless ranks 1..n across pages.
          for (let i = 0; i < expected.length; i++) {
            if (all[i].id !== expected[i].id) return false
            if (all[i].rank !== i + 1) return false
          }

          // The final page's `total` reflects the qualifying population exactly.
          const lastBody = pages[pages.length - 1].body as { total: number }
          if (lastBody.total !== expected.length) return false

          return true
        } finally {
          await deletePlayers(app, ids)
        }
      }),
      { seed: 20260925, numRuns: 12 },
    )
  }, 60_000)
})

describe('GET /api/rankings: min-matches rule and the fixed deleted-column bug (property)', () => {
  it('returns exactly the active, not-deleted, >= min_matches population, ranked by elo desc with a stable tie-break', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(specArb, { minLength: 3, maxLength: 12 }), async (specs: Spec[]) => {
        const ids: string[] = []
        try {
          for (const spec of specs) {
            const id = await seedPlayer(app, {
              elo: spec.elo,
              total_matches_played: spec.total_matches_played,
              status: spec.deleted ? 'deleted' : 'active',
              deleted_at: spec.deleted ? new Date() : null,
            })
            ids.push(id)
          }

          const minMatches = 1 // route default
          const expected = specs
            .map((s, i) => ({ id: ids[i], elo: s.elo, deleted: s.deleted, matches: s.total_matches_played }))
            .filter((p) => !p.deleted && p.matches >= minMatches)
            .sort((a, b) => (b.elo !== a.elo ? b.elo - a.elo : a.id.localeCompare(b.id)))

          const res = await app.request('GET', '/api/rankings', { query: { limit: '200', offset: '0' } })
          if (res.status !== 200) return false
          const body = res.body as { rankings: Array<{ id: string; rank: number }>; total: number }

          const returnedIds = body.rankings.map((r) => r.id)
          const deletedIds = new Set(ids.filter((_, i) => specs[i].deleted))
          if (returnedIds.some((id) => deletedIds.has(id))) return false

          const expectedIds = expected.map((e) => e.id)
          if (JSON.stringify(returnedIds) !== JSON.stringify(expectedIds)) return false
          if (body.total !== expected.length) return false

          return true
        } finally {
          await deletePlayers(app, ids)
        }
      }),
      { seed: 20260925, numRuns: 12 },
    )
  }, 60_000)

  // Named regression: rankings/index.get.ts used `.eq('deleted', false)` against a column that never
  // existed on `players`. Before the fix that made the route 500; it must now be a clean 200 with only
  // the active player visible.
  it('regression rankings/index.get.ts: no players.deleted column -> 200 with only the active player', async () => {
    const [activeId, deletedId] = await seedPlayers(app, [
      { name: 'Activa Regresión', elo: 1800, total_matches_played: 5, status: 'active' },
      { name: 'Borrada Regresión', elo: 2200, total_matches_played: 5, status: 'deleted', deleted_at: new Date() },
    ])
    try {
      const res = await app.request('GET', '/api/rankings')
      expect(res.status).toBe(200)
      const body = res.body as { rankings: Array<{ id: string }> }
      const ids = body.rankings.map((r) => r.id)
      expect(ids).toContain(activeId)
      expect(ids).not.toContain(deletedId)
    } finally {
      await deletePlayers(app, [activeId, deletedId])
    }
  })
})

describe('GET /api/leaderboard/nearby agrees with GET /api/leaderboard on the viewer rank (property)', () => {
  it('reports the same rank for the viewer as the full leaderboard does', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 4500 }), { minLength: 4, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        async (elos: number[], viewerIndexRaw: number) => {
          const viewerIndex = viewerIndexRaw % elos.length
          const ids: string[] = []
          try {
            for (const elo of elos) {
              ids.push(await seedPlayer(app, { elo, total_matches_played: 5 }))
            }
            const viewerId = ids[viewerIndex]

            const full = await app.request('GET', '/api/leaderboard', { query: { limit: '200', offset: '0' } })
            if (full.status !== 200) return false
            const fullBody = full.body as { rankings: Array<{ id: string; rank: number }> }
            const fromLeaderboard = fullBody.rankings.find((r) => r.id === viewerId)
            if (!fromLeaderboard) return false

            const nearby = await app.request('GET', '/api/leaderboard/nearby', { query: { player_id: viewerId, range: '5' } })
            if (nearby.status !== 200) return false
            const nearbyBody = nearby.body as { current_player: { id: string; rank: number } }

            return nearbyBody.current_player.id === viewerId && nearbyBody.current_player.rank === fromLeaderboard.rank
          } finally {
            await deletePlayers(app, ids)
          }
        },
      ),
      { seed: 20260925, numRuns: 10 },
    )
  }, 60_000)
})
