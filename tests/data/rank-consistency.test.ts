// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { deletePlayers, seedPlayer } from './rankings-helpers'

// One rank definition for every route (server/utils/ranking.ts; audit R1-R6). Oracle: a player's rank is the same
// number on the leaderboard (any filter), top, nearby, rankings and ranking-position, and equals
// 1 + ranked players with a strictly higher SR, where ranked = active, not deleted, at least one rated match.

let app: TestApp

beforeAll(async () => {
  app = await startTestApp()
}, 120_000)

afterAll(async () => {
  await app?.close()
})

type Row = { id: string; rank: number; elo: number }
const spec = fc.record({
  // few distinct values, so ties are common
  elo: fc.oneof(fc.constantFrom(1200, 1500, 1750, 2000, 2400), fc.integer({ min: 1, max: 4500 })),
  total_matches_played: fc.constantFrom(0, 0, 1, 3, 12),
})

describe('rank is one number everywhere (property)', () => {
  it('leaderboard (plain, by tier, by search), top, nearby, rankings and ranking-position agree for every player', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(spec, { minLength: 2, maxLength: 10 }), async (specs) => {
        const ids: string[] = []
        try {
          for (const [i, s] of specs.entries()) {
            ids.push(await seedPlayer(app, { name: `Rango ${i} jugador`, elo: s.elo, total_matches_played: s.total_matches_played }))
          }
          const ranked = specs.map((s, i) => ({ id: ids[i], ...s })).filter((p) => p.total_matches_played >= 1)
          const expectedRank = (elo: number) => 1 + ranked.filter((p) => p.elo > elo).length

          const board = (await app.request('GET', '/api/leaderboard', { query: { limit: '100' } })).body as { rankings: Row[] }
          const top = (await app.request('GET', '/api/leaderboard/top', { query: { limit: '50' } })).body as { top_players: Row[] }
          const rankings = (await app.request('GET', '/api/rankings', { query: { limit: '200' } })).body as { rankings: Row[] }

          for (const [i, s] of specs.entries()) {
            const id = ids[i]
            const position = (await app.request('GET', `/api/players/${id}/ranking-position`)).body as {
              is_unrated: boolean
              position: { global_rank: number } | null
            }
            const nearby = await app.request('GET', '/api/leaderboard/nearby', { query: { player_id: id } })

            if (s.total_matches_played === 0) {
              // R2: a seed is not a rank: nowhere in the lists, "unrated" in ranking-position
              expect(board.rankings.some((r) => r.id === id)).toBe(false)
              expect(top.top_players.some((r) => r.id === id)).toBe(false)
              expect(position.is_unrated).toBe(true)
              expect(nearby.status).toBe(404)
              continue
            }

            const rank = expectedRank(s.elo)
            expect(board.rankings.find((r) => r.id === id)?.rank).toBe(rank)
            expect(rankings.rankings.find((r) => r.id === id)?.rank).toBe(rank)
            expect(position.position?.global_rank).toBe(rank)
            expect((nearby.body as { current_player: Row }).current_player.rank).toBe(rank)
            const inTop = top.top_players.find((r) => r.id === id)
            if (inTop) expect(inTop.rank).toBe(rank)

            // R1 / R4: a filter chooses rows, it never renumbers them
            const tierOf = (board.rankings.find((r) => r.id === id) as Row & { rating_tier: string }).rating_tier
            const byTier = (await app.request('GET', '/api/leaderboard', { query: { tier: tierOf, limit: '100' } })).body as { rankings: Row[] }
            expect(byTier.rankings.find((r) => r.id === id)?.rank).toBe(rank)
            const byName = (await app.request('GET', '/api/leaderboard', { query: { search: `Rango ${i} `, limit: '100' } })).body as { rankings: Row[] }
            expect(byName.rankings.find((r) => r.id === id)?.rank).toBe(rank)
          }
          return true
        } finally {
          await deletePlayers(app, ids)
        }
      }),
      { seed: 20260926, numRuns: 10 },
    )
  }, 120_000)
})

describe('named regressions: rank (audit R1-R5)', () => {
  it('R1: the Ranking page tier filter shows the global rank, not a position inside the tier', async () => {
    const ids = [
      await seedPlayer(app, { elo: 3100, total_matches_played: 5 }),
      await seedPlayer(app, { elo: 1600, total_matches_played: 5 }),
    ]
    try {
      const res = await app.request('GET', '/api/leaderboard', { query: { tier: 'Silver' } })
      const silver = (res.body as { rankings: Row[] }).rankings.find((r) => r.id === ids[1])
      expect(silver?.rank).toBe(2)
    } finally {
      await deletePlayers(app, ids)
    }
  })

  it('R2: a sign-up seeded at 2500 with no match is not #1 on /top', async () => {
    const ids = [
      await seedPlayer(app, { elo: 2500, total_matches_played: 0 }),
      await seedPlayer(app, { elo: 1900, total_matches_played: 4 }),
    ]
    try {
      const top = (await app.request('GET', '/api/leaderboard/top')).body as { top_players: Row[] }
      expect(top.top_players[0]?.id).toBe(ids[1])
      expect(top.top_players.some((r) => r.id === ids[0])).toBe(false)
    } finally {
      await deletePlayers(app, ids)
    }
  })

  it('R3: two players at 1750 share a rank on every route', async () => {
    const ids = [
      await seedPlayer(app, { elo: 1800, total_matches_played: 2 }),
      await seedPlayer(app, { elo: 1750, total_matches_played: 2 }),
      await seedPlayer(app, { elo: 1750, total_matches_played: 2 }),
      await seedPlayer(app, { elo: 1700, total_matches_played: 2 }),
    ]
    try {
      const board = (await app.request('GET', '/api/leaderboard')).body as { rankings: Row[] }
      expect(ids.map((id) => board.rankings.find((r) => r.id === id)?.rank)).toEqual([1, 2, 2, 4])
    } finally {
      await deletePlayers(app, ids)
    }
  })

  it('R5: /api/rankings?tier=Gold filters before paging: a Gold player below 3 Diamond players is on page 1', async () => {
    const ids = [
      await seedPlayer(app, { elo: 3300, total_matches_played: 3 }),
      await seedPlayer(app, { elo: 3200, total_matches_played: 3 }),
      await seedPlayer(app, { elo: 3100, total_matches_played: 3 }),
      await seedPlayer(app, { elo: 2100, total_matches_played: 3 }),
    ]
    try {
      const res = await app.request('GET', '/api/rankings', { query: { tier: 'Gold', limit: '2' } })
      const body = res.body as { rankings: Row[]; total: number }
      expect(body.rankings.map((r) => r.id)).toEqual([ids[3]])
      expect(body.rankings[0].rank).toBe(4)
      expect(body.total).toBe(1)
    } finally {
      await deletePlayers(app, ids)
    }
  })
})
