// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { applyReplay, planReplay } from '../../server/utils/rating-replay'
import { activeMatch, approve, createCategory, createPlayer, put, type Account } from './matches-helpers'

// The recompute tool (scripts/recompute-ratings.ts). Differential oracle: replaying the confirmed matches in order
// reproduces what the live approvals wrote, and applying a replay is idempotent.

let app: TestApp
const categories: string[] = []

beforeAll(async () => {
  app = await startTestApp()
  for (const elo of [1000, 1500, 2250]) categories.push(await createCategory(app, elo))
}, 120_000)

afterAll(async () => {
  await app?.close()
})

const flipped = (score: string) => score.replace(/(\d+)-(\d+)/g, (_, a, b) => `${b}-${a}`)
const scenario = fc.integer({ min: 3, max: 4 }).chain((n) =>
  fc.record({
    categoryOf: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: n, maxLength: n }),
    matches: fc.array(
      fc.record({
        pair: fc.uniqueArray(fc.integer({ min: 0, max: n - 1 }), { minLength: 2, maxLength: 2 }),
        p1Wins: fc.boolean(),
        score: fc.constantFrom('6-3 6-4', '6-4 3-6 7-6(5)', '6-2 4-6 10-8', '6-4 2-1 ret.', 'W/O'),
      }),
      { minLength: 1, maxLength: 6 },
    ),
  }),
)

async function players(ids: string[]) {
  const { rows } = await app.client.query<{ id: string; elo: number; total_matches_played: number }>(
    `select id, elo, total_matches_played from players where id = any($1) order by id`,
    [ids],
  )
  return rows
}

describe('replay', () => {
  it('replaying the live history reproduces every rating; applying it twice changes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ categoryOf, matches }) => {
        const accounts: Account[] = []
        for (const c of categoryOf) accounts.push(await createPlayer(app, categories[c], 'replay'))
        const ids = accounts.map((a) => a.playerId)
        const perPair = new Map<string, number>()
        for (const m of matches) {
          const key = [...m.pair].sort().join()
          if ((perPair.get(key) ?? 0) >= 4) continue
          perPair.set(key, (perPair.get(key) ?? 0) + 1)
          const [p1, p2] = [accounts[m.pair[0]], accounts[m.pair[1]]]
          const matchId = await activeMatch(app, p1, p2)
          const winner = m.p1Wins ? p1 : p2
          const score = m.p1Wins || m.score.includes('ret.') ? m.score : flipped(m.score)
          expect((await put(app, p1, matchId, 'propose_score', { score, winner_id: winner.playerId })).status).toBe(200)
          expect((await approve(app, p2, matchId)).status).toBe(200)
        }

        const live = await players(ids)
        const plan = await planReplay(app.db)
        for (const p of live) {
          if (plan.result.ratings.has(p.id)) expect(plan.result.ratings.get(p.id)).toBe(p.elo)
        }

        await applyReplay(app.db)
        const once = await players(ids)
        expect(once).toEqual(live)
        await applyReplay(app.db)
        expect(await players(ids)).toEqual(once)

        const { rows } = await app.client.query<{ player_id: string; elo_after: number }>(
          `select distinct on (player_id) player_id, elo_after from rating_history
            where player_id = any($1) and rating_reversed = false order by player_id, created_at desc, id desc`,
          [ids],
        )
        for (const r of rows) expect(r.elo_after).toBe(once.find((p) => p.id === r.player_id)!.elo)
        return true
      }),
      { seed: 20260926, numRuns: 6, endOnFailure: true },
    )
  }, 300_000)

  // Found by the property above (seed 20260926, first run): one apply wrote every row in one transaction, so they all
  // shared created_at and the next apply took an arbitrary row as a player's seed (2145 became 2147, 1605 became 1655).
  it('regression: a second apply seeds each player from their first match in replay order, not from row timestamps', async () => {
    const accounts: Account[] = []
    for (const c of [2, 1, 0, 2]) accounts.push(await createPlayer(app, categories[c], 'semilla'))
    const plays: Array<[number, number, boolean, string]> = [
      [1, 0, true, 'W/O'],
      [1, 0, true, '6-4 2-1 ret.'],
      [1, 0, false, '6-2 4-6 10-8'],
      [2, 3, false, '6-2 4-6 10-8'],
      [2, 0, false, 'W/O'],
      [1, 0, true, '6-2 4-6 10-8'],
    ]
    for (const [i, j, p1Wins, score] of plays) {
      const matchId = await activeMatch(app, accounts[i], accounts[j])
      const text = p1Wins || score.includes('ret.') ? score : flipped(score)
      await put(app, accounts[i], matchId, 'propose_score', { score: text, winner_id: (p1Wins ? accounts[i] : accounts[j]).playerId })
      expect((await approve(app, accounts[j], matchId)).status).toBe(200)
    }
    const ids = accounts.map((a) => a.playerId)
    const live = await players(ids)
    await applyReplay(app.db)
    await applyReplay(app.db)
    expect(await players(ids)).toEqual(live)
  })

  it('a history rated by the old formulas is recomputed: +30 / -12 (audit B1) becomes zero-sum', async () => {
    const [a, b] = [await createPlayer(app, categories[1], 'viejo'), await createPlayer(app, categories[1], 'viejo')]
    const matchId = await activeMatch(app, a, b)
    await put(app, a, matchId, 'propose_score', { score: '6-3 6-4', winner_id: a.playerId })
    expect((await approve(app, b, matchId)).status).toBe(200)
    // Rewrite it the way the old system rated a newcomer beating an established player
    await app.client.query(
      `update rating_history set elo_change = case when player_id = $1 then 30 else -12 end,
              elo_after = elo_before + case when player_id = $1 then 30 else -12 end, reasoning_preview = null
        where match_id = $2`,
      [a.playerId, matchId],
    )
    await app.client.query(`update players set elo = 1530 where id = $1`, [a.playerId])
    await app.client.query(`update players set elo = 1488 where id = $1`, [b.playerId])

    const plan = await planReplay(app.db)
    expect(plan.result.ratings.get(a.playerId)! - 1500).toBe(-(plan.result.ratings.get(b.playerId)! - 1500))
    await applyReplay(app.db)
    const [pa, pb] = [(await players([a.playerId]))[0], (await players([b.playerId]))[0]]
    expect(pa.elo + pb.elo).toBe(3000)
  })
})
