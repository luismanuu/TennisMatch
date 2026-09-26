// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { startTestApp, type TestApp } from '../security/harness'
import { approve, createCategory, createPlayer, FUTURE, put, type Account } from './matches-helpers'

let app: TestApp
const categories: string[] = []

beforeAll(async () => {
  app = await startTestApp()
  // Different category defaults, so unrated players enter at different ratings
  for (const elo of [1000, 1500, 2250]) categories.push(await createCategory(app, elo))
}, 120_000)

afterAll(async () => {
  await app?.close()
})

// One set, from the winner's side: 6-0..6-4, 7-5, 7-6 with a tiebreak; the loser may take one set of a best of 3
const wonSet = fc.oneof(
  fc.integer({ min: 0, max: 4 }).map((l) => [6, l] as const),
  fc.constant([7, 5] as const),
  fc.integer({ min: 0, max: 10 }).map((tb) => [7, 6, tb] as const),
)

type Played = {
  p1: number // index into the run's players
  p2: number
  player1Wins: boolean
  proposerIsPlayer1: boolean
  competitive: boolean
  walkover: boolean
  sets: Array<{ set: readonly number[]; winnerTook: boolean }>
  separator: string
}

const matchPlan = (players: number) =>
  fc
    .record({
      pair: fc.uniqueArray(fc.integer({ min: 0, max: players - 1 }), { minLength: 2, maxLength: 2 }),
      player1Wins: fc.boolean(),
      proposerIsPlayer1: fc.boolean(),
      competitive: fc.integer({ min: 0, max: 5 }).map((n) => n !== 0), // mostly competitive
      walkover: fc.integer({ min: 0, max: 9 }).map((n) => n === 0),
      winnerSets: fc.array(wonSet, { minLength: 2, maxLength: 2 }),
      loserSet: fc.option(wonSet, { nil: undefined }),
      separator: fc.constantFrom(', ', ' ', ','),
    })
    .map((r): Played => {
      const sets = r.winnerSets.map((set) => ({ set, winnerTook: true }))
      if (r.loserSet) sets.splice(1, 0, { set: r.loserSet, winnerTook: false })
      return {
        p1: r.pair[0],
        p2: r.pair[1],
        player1Wins: r.player1Wins,
        proposerIsPlayer1: r.proposerIsPlayer1,
        competitive: r.competitive,
        walkover: r.walkover,
        sets,
        separator: r.separator,
      }
    })

// The score as player 1 reports it (player 1's games first), the format parseGamesFromScore reads
function scoreText(m: Played): string {
  if (m.walkover) return 'WO'
  return m.sets
    .map(({ set, winnerTook }) => {
      const [w, l, tb] = set
      const player1Took = winnerTook === m.player1Wins
      const games = player1Took ? `${w}-${l}` : `${l}-${w}`
      return tb === undefined ? games : `${games}(${tb})`
    })
    .join(m.separator)
}

const scenario = fc.integer({ min: 3, max: 4 }).chain((n) =>
  fc.record({
    categoryOf: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: n, maxLength: n }),
    matches: fc.array(matchPlan(n), { minLength: 1, maxLength: 7 }),
  }),
)

async function snapshot(ids: string[]) {
  const players = (
    await app.client.query<{ id: string; elo: number; total_matches_played: number }>(
      `select id, elo, total_matches_played from players where id = any($1)`,
      [ids],
    )
  ).rows
  const latest = (
    await app.client.query<{ player_id: string; elo_after: number }>(
      `select distinct on (player_id) player_id, elo_after from rating_history
       where player_id = any($1) and rating_reversed = false order by player_id, created_at desc`,
      [ids],
    )
  ).rows
  const completed = (
    await app.client.query<{ player_id: string; n: number }>(
      `select p.id as player_id, count(m.id)::int as n from players p
       left join matches m on (m.player1_id = p.id or m.player2_id = p.id) and m.status = 'completed' and m.is_competitive
         and m.score <> 'W/O'
       where p.id = any($1) group by p.id`,
      [ids],
    )
  ).rows
  return { players, latest, completed }
}

describe('rating writes keep the ledger consistent (property over random match sequences)', () => {
  it('after every approval: players.elo = latest live rating_history.elo_after, total_matches_played = completed competitive matches, winner never loses points', async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ categoryOf, matches }) => {
        const accounts: Account[] = []
        for (const c of categoryOf) accounts.push(await createPlayer(app, categories[c], 'prop'))
        const ids = accounts.map((a) => a.playerId)
        const initialElo = new Map((await snapshot(ids)).players.map((p) => [p.id, p.elo]))
        const competitiveWithPair = new Map<string, number>()

        for (const m of matches) {
          const p1 = accounts[m.p1]
          const p2 = accounts[m.p2]
          const pairKey = [p1.playerId, p2.playerId].sort().join()
          const priorCompetitive = competitiveWithPair.get(pairKey) ?? 0

          const created = await app.request('POST', '/api/matches', {
            cookie: p1.cookie,
            body: { player1_id: p1.playerId, player2_id: p2.playerId, scheduled_at: FUTURE, is_competitive: m.competitive },
          })
          // Product rule: at most 4 competitive matches between the same two players per month
          if (m.competitive && priorCompetitive >= 4) {
            expect(created.status).toBe(400)
            continue
          }
          expect(created.status, JSON.stringify(created.body)).toBe(200)
          const matchId = (created.body as { id: string }).id
          expect((await put(app, p2, matchId, 'accept_match')).status).toBe(200)
          expect((await put(app, p1, matchId, 'update_status', { status: 'active' })).status).toBe(200)

          const winner = m.player1Wins ? p1 : p2
          const loser = m.player1Wins ? p2 : p1
          const proposer = m.proposerIsPlayer1 ? p1 : p2
          const approver = m.proposerIsPlayer1 ? p2 : p1
          const score = scoreText(m)
          expect((await put(app, proposer, matchId, 'propose_score', { score, winner_id: winner.playerId })).status).toBe(200)
          const approved = await approve(app, approver, matchId)
          expect(approved.status).toBe(200)
          if (m.competitive) competitiveWithPair.set(pairKey, priorCompetitive + 1)

          const { players, latest, completed } = await snapshot(ids)
          for (const p of players) {
            const live = latest.find((l) => l.player_id === p.id)
            // No live history yet: still the rating the player was created with
            expect(p.elo, `elo of ${p.id} after "${score}"`).toBe(live ? live.elo_after : initialElo.get(p.id))
            expect(p.total_matches_played).toBe(completed.find((c) => c.player_id === p.id)?.n)
          }

          const rows = (
            await app.client.query<{ player_id: string; elo_change: number; was_winner: boolean }>(
              `select player_id, elo_change, was_winner from rating_history where match_id = $1`,
              [matchId],
            )
          ).rows
          // Friendlies and walkovers are completed but never rated
          if (!m.competitive || m.walkover) {
            expect(rows).toEqual([])
            continue
          }
          expect(rows).toHaveLength(2)
          const w = rows.find((r) => r.player_id === winner.playerId)!
          const l = rows.find((r) => r.player_id === loser.playerId)!
          expect(w.was_winner).toBe(true)
          expect(l.was_winner).toBe(false)
          expect(w.elo_change).toBeGreaterThanOrEqual(0)
          expect(l.elo_change + w.elo_change).toBe(0)
        }
        return true
      }),
      { seed: 20260925, numRuns: 8, endOnFailure: true },
    )
  }, 300_000)
})
