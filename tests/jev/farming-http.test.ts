// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createPlayer, type Account } from '../data/matches-helpers'
import { resetJevBreakerForTests } from '../../server/utils/jev'
import { FARMING_FLAG_SCORE, FARMING_QUESTIONS, computePairFacts, judgePair, type PairMatch } from '../../server/utils/farming'
import { answersFor, fakeGateway, FLAGS_ON, gatewayFailure, probability, SEED, type GatewayBehaviour } from './helpers'
import { setupJevTestApp } from './http-harness'

const t = setupJevTestApp()

describe('rating-farming review', () => {
  let a: Account
  let b: Account
  let c: Account
  let admin: { cookie: string }

  async function completedMatch(winner: Account, loser: Account, score: string) {
    const { rows } = await t.app.client.query<{ id: string }>(
      `insert into matches (player1_id, player2_id, winner_id, status, score, is_competitive, played_at, score_proposed_by, score_proposed_at)
       values ($1, $2, $1, 'completed', $3, true, now() - interval '3 days', $1, now() - interval '3 days') returning id`,
      [winner.playerId, loser.playerId, score],
    )
    for (const [p, change, won] of [[winner, 25, true], [loser, -25, false]] as const) {
      await t.app.client.query(
        `insert into rating_history (player_id, match_id, elo_before, elo_after, elo_change, mmr_before, mmr_after, mmr_change,
           uncertainty_before, uncertainty_after, k_factor, expected_score, actual_score, was_winner, created_at)
         values ($1, $2, 1500, 1500 + $3, $3, 0, 0, 0, 2, 2, 32, 0.5, $4, $5, now() - interval '3 days' + interval '4 minutes')`,
        [p.playerId, rows[0].id, change, won ? 1 : 0, won],
      )
    }
  }

  async function snapshot() {
    const out: Record<string, unknown> = {}
    for (const table of ['players', 'matches', 'rating_history', 'notifications', 'match_messages']) {
      out[table] = (await t.app.client.query(`select * from ${table} order by id`)).rows
    }
    return JSON.stringify(out)
  }

  beforeAll(async () => {
    a = await createPlayer(t.app, t.categoryId, 'granja-a')
    b = await createPlayer(t.app, t.categoryId, 'granja-b')
    c = await createPlayer(t.app, t.categoryId, 'granja-c')
    const adminAccount = await createPlayer(t.app, t.categoryId, 'granja-admin')
    await t.app.setRole(adminAccount.userId, 'admin')
    admin = adminAccount
    for (let i = 0; i < 5; i++) await completedMatch(a, b, '6-0, 6-1')
    for (let i = 0; i < 2; i++) await completedMatch(a, c, '6-4, 4-6, 7-5')
  })

  it('whatever Jev answers or however it fails, the scan never writes to players, matches, ratings, notifications or messages', async () => {
    const before = await snapshot()
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          gatewayFailure,
          fc.array(probability, { minLength: 4, maxLength: 4 }).map((d): GatewayBehaviour => {
            let i = 0
            return { kind: 'body', body: answersFor(FARMING_QUESTIONS, () => d[i++ % 4]) }
          }),
        ),
        async (behaviour) => {
          resetJevBreakerForTests()
          const gw = t.useGateway(behaviour)
          const res = await t.app.request('POST', '/api/admin/jev/farming-scan', { cookie: admin.cookie })
          t.releaseGateway()
          expect(res.status).toBe(200)
          const pairs = (res.body as any).pairs as Array<{ status: string; facts: { matches: number }; player_a: { id: string }; player_b: { id: string } }>
          const ab = pairs.find((p) => [p.player_a.id, p.player_b.id].sort().join() === [a.playerId, b.playerId].sort().join())
          expect(ab?.facts.matches).toBe(5)
          expect(pairs.some((p) => [p.player_a.id, p.player_b.id].includes(c.playerId))).toBe(false)
          if (behaviour.kind !== 'body' || !(behaviour.body as any)?.answers?.risk) expect(ab?.status).toBe('unchecked')
          expect(gw.calls.every((call) => !JSON.stringify(call.body).includes('granja'))).toBe(true)
          expect(await snapshot()).toBe(before)
        },
      ),
      { seed: SEED, numRuns: 15 },
    )
  })

  it('with the flag off the scan is disabled and never calls the gateway', async () => {
    process.env.JEV_FARMING_ENABLED = 'false'
    const gw = t.useGateway({ kind: 'status', status: 500 })
    const res = await t.app.request('POST', '/api/admin/jev/farming-scan', { cookie: admin.cookie })
    expect(res.body).toEqual({ enabled: false, pairs: [] })
    expect(gw.calls).toHaveLength(0)
  })

  it('a pair is flagged exactly when Jev\'s risk score reaches the bar; a failed call is unchecked, never clear', async () => {
    const facts = computePairFacts({ matches: [], accountAgeDaysA: 1, accountAgeDaysB: 1, totalMatchesA: 0, totalMatchesB: 0, ratingPointsToA: 0 })
    await fc.assert(
      fc.asyncProperty(fc.oneof(probability.map((p) => p * 4), fc.constantFrom(0, 2.49, 2.5, 4)), async (risk) => {
        const gw = fakeGateway({
          kind: 'body',
          body: {
            answers: {
              risk: { type: 'score', score: risk, probabilities: { '0': 0.2, '1': 0.2, '2': 0.2, '3': 0.2, '4': 0.2 } },
              one_sided: { type: 'boolean', probability: 0.5 },
            },
          },
        })
        const judged = await judgePair(facts, { env: FLAGS_ON, fetchImpl: gw.fetchImpl })
        expect(judged.status).toBe(risk >= FARMING_FLAG_SCORE ? 'flagged' : 'clear')
      }),
      { seed: SEED, numRuns: 100 },
    )
    const failed = await judgePair(facts, { env: FLAGS_ON, fetchImpl: fakeGateway({ kind: 'status', status: 503 }).fetchImpl })
    expect(failed).toEqual({ status: 'unchecked', risk_score: null, one_sided_probability: null })
  })

  it('computed facts are internally consistent for any series of matches', () => {
    const match = fc.record({
      id: fc.uuid(),
      winner_is_a: fc.boolean(),
      score: fc.option(fc.oneof(fc.constantFrom('6-0, 6-1', '6-4 3-6 7-6', 'WO', '6–2 6–2', ''), fc.string()), { nil: null }),
      proposed_by_winner: fc.option(fc.boolean(), { nil: null }),
      minutes_to_confirm: fc.option(fc.nat({ max: 100_000 }), { nil: null }),
    }) as fc.Arbitrary<PairMatch>
    fc.assert(
      fc.property(fc.array(match, { maxLength: 40 }), fc.nat(), fc.nat(), fc.nat(), fc.nat(), fc.integer({ min: -2000, max: 2000 }), (ms, ageA, ageB, extraA, extraB, points) => {
        const f = computePairFacts({
          matches: ms,
          accountAgeDaysA: ageA,
          accountAgeDaysB: ageB,
          totalMatchesA: ms.length + extraA,
          totalMatchesB: ms.length + extraB,
          ratingPointsToA: points,
        })
        expect(f.wins_a + f.wins_b).toBe(ms.length)
        expect(f.wide_margin_matches + f.unreadable_scores).toBeLessThanOrEqual(ms.length)
        expect(f.proposed_by_winner).toBeLessThanOrEqual(ms.length)
        for (const share of [f.share_of_a_matches, f.share_of_b_matches]) {
          expect(share).toBeGreaterThanOrEqual(0)
          expect(share).toBeLessThanOrEqual(1)
        }
        const confirms = ms.map((m) => m.minutes_to_confirm).filter((x): x is number => x !== null)
        if (confirms.length === 0) expect(f.median_minutes_to_confirm).toBeNull()
        else {
          expect(f.median_minutes_to_confirm!).toBeGreaterThanOrEqual(Math.min(...confirms))
          expect(f.median_minutes_to_confirm!).toBeLessThanOrEqual(Math.max(...confirms))
        }
      }),
      { seed: SEED, numRuns: 300 },
    )
  })
})
