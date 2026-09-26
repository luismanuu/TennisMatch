// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { eq, inArray } from 'drizzle-orm'
import { players } from '../../server/db/schema'
import { startTestApp, type TestApp } from '../security/harness'
import { deletePlayers, seedPlayer } from './rankings-helpers'

let app: TestApp
let admin: { cookie: string; userId: string }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signUp('rankings-admin@tenis.ec', 'admin')
}, 120_000)

afterAll(async () => {
  await app?.close()
})

// The one rank definition (server/utils/ranking.ts): 1 + players with a strictly higher SR; ties share a rank
function expectedRanks(rows: Array<{ id: string; elo: number }>): Map<string, number> {
  return new Map(rows.map((r) => [r.id, 1 + rows.filter((o) => o.elo > r.elo).length]))
}

describe('POST /api/admin/rankings/update-previous-ranks (property)', () => {
  it('sets each active player previous_rank to their rank at that moment, then rank_change reflects a later elo change correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ elo: fc.integer({ min: 1, max: 4500 }), delta: fc.integer({ min: -300, max: 300 }) }), {
          minLength: 3,
          maxLength: 8,
        }),
        async (rows) => {
          const ids: string[] = []
          try {
            for (const r of rows) {
              ids.push(await seedPlayer(app, { elo: r.elo, total_matches_played: 5 }))
            }

            const res = await app.request('POST', '/api/admin/rankings/update-previous-ranks', { cookie: admin.cookie })
            if (res.status !== 200) return false

            const before = ids.map((id, i) => ({ id, elo: rows[i].elo }))
            const expectedBefore = expectedRanks(before)

            const dbRows = await app.db.select({ id: players.id, previous_rank: players.previous_rank }).from(players).where(inArray(players.id, ids))
            for (const row of dbRows) {
              if (row.previous_rank !== expectedBefore.get(row.id)) return false
            }

            // Now change elos (as a batch of results would) and check the rank_change indicators.
            for (let i = 0; i < ids.length; i++) {
              const newElo = Math.max(1, rows[i].elo + rows[i].delta)
              await app.db.update(players).set({ elo: newElo }).where(eq(players.id, ids[i]))
            }

            const after = ids.map((id, i) => ({ id, elo: Math.max(1, rows[i].elo + rows[i].delta) }))
            const expectedAfter = expectedRanks(after)

            const lb = await app.request('GET', '/api/leaderboard', { query: { limit: '200', offset: '0' } })
            if (lb.status !== 200) return false
            const lbBody = lb.body as { rankings: Array<{ id: string; rank: number; previous_rank?: number; rank_change?: number }> }

            for (const id of ids) {
              const entry = lbBody.rankings.find((r) => r.id === id)
              if (!entry) return false
              const expectedNewRank = expectedAfter.get(id)!
              const expectedOldRank = expectedBefore.get(id)!
              if (entry.rank !== expectedNewRank) return false
              if (entry.previous_rank !== expectedOldRank) return false
              if (entry.rank_change !== expectedOldRank - expectedNewRank) return false
            }

            return true
          } finally {
            await deletePlayers(app, ids)
          }
        },
      ),
      { seed: 20260925, numRuns: 10 },
    )
  }, 60_000)
})
