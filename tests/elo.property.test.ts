// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  K_ESTABLISHED,
  K_PLACEMENT,
  MAX_MARGIN_FACTOR,
  RATING_FLOOR,
  classifyStoredScore,
  parseExplanation,
  isRatable,
  ratePair,
  rateMatch,
  replayRatings,
  type MatchClassification,
  type ReplayMatch,
} from '../server/utils/elo'

// The SR formula (server/utils/elo.ts), checked against properties any correct Elo must have, for every input the
// generators reach. Fixed seeds: a failure reproduces.
const SEED = 20260926
const RUNS = 2000

const rating = fc.oneof(
  fc.integer({ min: RATING_FLOOR, max: 4500 }),
  fc.constantFrom(RATING_FLOOR, 2, 30, 500, 1000, 1500, 2500, 4000, 4500),
)
const experience = fc.oneof(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 300 }))
const player = fc.record({ rating, ratedMatches: experience })
const classification: fc.Arbitrary<MatchClassification> = fc.oneof(
  fc.record({
    completion: fc.constant('completed' as const),
    sets: fc.constantFrom('straight' as const, 'deciding' as const, 'pro' as const, 'unknown' as const),
    source: fc.constantFrom('manual' as const, 'parser' as const, 'jev' as const),
  }),
  fc.record({ completion: fc.constant('retired' as const), sets: fc.constant('incomplete' as const), source: fc.constant('parser' as const) }),
  fc.record({ completion: fc.constantFrom('walkover' as const, 'abandoned' as const), sets: fc.constant('none' as const), source: fc.constantFrom('manual' as const, 'parser' as const) }),
)
// Equal ratings and huge gaps get their own generator: the uniform one rarely hits them
const pair = fc.oneof(
  fc.tuple(player, player),
  player.chain((a) => fc.tuple(fc.constant(a), fc.record({ rating: fc.constant(a.rating), ratedMatches: experience }))),
  fc.tuple(fc.record({ rating: fc.integer({ min: 3500, max: 4500 }), ratedMatches: experience }), fc.record({ rating: fc.integer({ min: 1, max: 600 }), ratedMatches: experience })),
)

describe('rateMatch: properties', () => {
  it('zero-sum: the loser loses exactly what the winner gains', () => {
    fc.assert(
      fc.property(pair, classification, ([w, l], c) => {
        const o = rateMatch(w, l, c)
        expect(o.winner.delta + o.loser.delta).toBe(0)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('symmetry: swapping player 1 and player 2 mirrors the result', () => {
    fc.assert(
      fc.property(pair, fc.constantFrom('p1' as const, 'p2' as const), classification, ([a, b], winner, c) => {
        const straight = ratePair(a, b, winner, c)
        const swapped = ratePair(b, a, winner === 'p1' ? 'p2' : 'p1', c)
        expect(swapped.p1).toEqual(straight.p2)
        expect(swapped.p2).toEqual(straight.p1)
        expect(swapped.k).toBe(straight.k)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('monotonic: beating a stronger opponent gains at least as much as beating a weaker one', () => {
    fc.assert(
      fc.property(player, experience, rating, rating, classification, (w, lExp, r1, r2, c) => {
        const [weaker, stronger] = r1 <= r2 ? [r1, r2] : [r2, r1]
        const gainWeak = rateMatch(w, { rating: weaker, ratedMatches: lExp }, c).winner.delta
        const gainStrong = rateMatch(w, { rating: stronger, ratedMatches: lExp }, c).winner.delta
        expect(gainStrong).toBeGreaterThanOrEqual(gainWeak)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('bounded: |Δ| ≤ round(K · max margin), K is one of the documented values, the winner never loses', () => {
    fc.assert(
      fc.property(pair, classification, ([w, l], c) => {
        const o = rateMatch(w, l, c)
        expect([K_ESTABLISHED, K_PLACEMENT, (K_ESTABLISHED + K_PLACEMENT) / 2]).toContain(o.k)
        expect(Math.abs(o.winner.delta)).toBeLessThanOrEqual(Math.round(o.k * MAX_MARGIN_FACTOR))
        expect(o.winner.delta).toBeGreaterThanOrEqual(0)
        expect(o.loser.after).toBeGreaterThanOrEqual(RATING_FLOOR)
        if (!isRatable(c)) expect(o.winner.delta).toBe(0)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('deterministic: the same inputs give the same output, whatever ran before', () => {
    fc.assert(
      fc.property(pair, classification, pair, classification, ([w, l], c, [w2, l2], c2) => {
        const first = rateMatch(w, l, c)
        rateMatch(w2, l2, c2)
        expect(rateMatch({ ...w }, { ...l }, { ...c })).toEqual(first)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})

describe('replayRatings: properties', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const replayMatch = fc
    .record({
      pair: fc.uniqueArray(fc.constantFrom(...ids), { minLength: 2, maxLength: 2 }),
      p1Wins: fc.boolean(),
      at: fc.integer({ min: 0, max: 20 }), // few distinct times: many ties, broken by id
      classification,
    })
    .map(({ pair: [p1, p2], p1Wins, at, classification: c }, ) => ({ p1, p2, winner: p1Wins ? p1 : p2, at, c }))
  const scenario = fc.record({
    seeds: fc.array(fc.integer({ min: 800, max: 2600 }), { minLength: ids.length, maxLength: ids.length }),
    matches: fc.array(replayMatch, { minLength: 0, maxLength: 40 }),
  })
  const build = (s: { seeds: number[]; matches: Array<{ p1: string; p2: string; winner: string; at: number; c: MatchClassification }> }) => ({
    seeds: new Map(ids.map((id, i) => [id, s.seeds[i]])),
    matches: s.matches.map((m, i): ReplayMatch => ({ id: `m${String(i).padStart(3, '0')}`, player1: m.p1, player2: m.p2, winner: m.winner, at: m.at, classification: m.c })),
  })

  it('order-stable: the same set of matches in any input order replays to the same ratings and rows', () => {
    fc.assert(
      fc.property(scenario, fc.integer(), (s, shuffleSeed) => {
        const { seeds, matches } = build(s)
        const shuffled = fc.sample(fc.shuffledSubarray(matches, { minLength: matches.length, maxLength: matches.length }), { seed: shuffleSeed, numRuns: 1 })[0]
        const a = replayRatings(seeds, matches)
        const b = replayRatings(seeds, shuffled)
        expect(b.rows).toEqual(a.rows)
        expect([...b.ratings]).toEqual([...a.ratings])
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  it('conserves the pool: the sum of all ratings never changes', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { seeds, matches } = build(s)
        const r = replayRatings(seeds, matches)
        const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((x, y) => x + y, 0)
        expect(sum(r.ratings)).toBe(sum(seeds))
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  it('the rated-match count feeds K: a player is in placement for exactly their first 3 rated matches', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { seeds, matches } = build(s)
        const seen = new Map<string, number>()
        for (const row of replayRatings(seeds, matches).rows) {
          for (const [id, side] of [[row.winner, row.outcome.winner], [row.loser, row.outcome.loser]] as const) {
            const n = seen.get(id) ?? 0
            expect(side.isPlacement).toBe(n < 3)
            seen.set(id, n + 1)
          }
        }
      }),
      { seed: SEED, numRuns: 300 },
    )
  })
})

// Named regressions: the audit's findings (.aria/reports/tennismatch-elo-audit-2026-09-26.md), with the real inputs
describe('named regressions from the audit', () => {
  const straight: MatchClassification = { completion: 'completed', sets: 'straight', source: 'parser' }

  it('B1: a newcomer (0 matches) at 1500 beating an established 1500 no longer creates points (was +30 / -12)', () => {
    const o = rateMatch({ rating: 1500, ratedMatches: 0 }, { rating: 1500, ratedMatches: 10 }, straight)
    expect(o.k).toBe(46)
    expect(o.winner.delta).toBe(25)
    expect(o.loser.delta).toBe(-25)
  })

  it('B5: placement vs established at 1500 is zero-sum (was +25 / -20)', () => {
    const o = rateMatch({ rating: 1500, ratedMatches: 1 }, { rating: 1500, ratedMatches: 10 }, straight)
    expect(o.winner.delta).toBe(-o.loser.delta)
  })

  it('B6: one formula: established 1500 v 1500 in straight sets is +18 / -18 on every path (was 20, 16 or the LLM)', () => {
    const o = rateMatch({ rating: 1500, ratedMatches: 10 }, { rating: 1500, ratedMatches: 10 }, straight)
    expect([o.k, o.margin, o.winner.delta, o.loser.delta]).toEqual([32, 1.1, 18, -18])
  })

  it('B7: the winner never loses SR, even as a 4500 favourite against a 1-rated opponent', () => {
    const o = rateMatch({ rating: 4500, ratedMatches: 50 }, { rating: 1, ratedMatches: 50 }, straight)
    expect(o.winner.delta).toBe(0)
    expect(o.loser.after).toBe(1)
  })

  // Found by the ledger property (matches-rating-property, seed 20260925): a 0-point win made the loser's delta -0
  it('regression: a 0-point result is +0 for the loser, not -0 (1000 v 2250, placement K, deciding set)', () => {
    const o = rateMatch({ rating: 2250, ratedMatches: 0 }, { rating: 1000, ratedMatches: 0 }, { completion: 'completed', sets: 'deciding', source: 'parser' })
    expect(o.winner.delta).toBe(0)
    expect(Object.is(o.loser.delta, 0)).toBe(true)
  })

  it('B10: walkover spellings are recognised and never rated ("W/O", "wo", "w.o.")', () => {
    for (const text of ['W/O', 'wo', 'w.o.', 'WO', 'Walkover']) {
      const c = classifyStoredScore(text)
      expect(c.completion).toBe('walkover')
      expect(isRatable(c)).toBe(false)
    }
  })

  it('legacy free text that the parser cannot read still rates, at factor 1', () => {
    const c = classifyStoredScore('ganamos por abandono')
    expect(c).toEqual({ completion: 'completed', sets: 'unknown', source: 'parser' })
    expect(rateMatch({ rating: 1500, ratedMatches: 10 }, { rating: 1500, ratedMatches: 10 }, c).winner.delta).toBe(16)
  })
})

describe('parseExplanation', () => {
  it('returns null for legacy LLM reasoning text, a wrong formula version, and broken JSON', () => {
    expect(parseExplanation('Player 1 won a close match against a stronger opponent, so +17 SR.')).toBeNull()
    expect(parseExplanation(JSON.stringify({ formula: 'elo-v1', k: 32, margin: 1, expected: 0.5, opponent_before: 1500, classification: { completion: 'completed', sets: 'straight', source: 'parser' } }))).toBeNull()
    expect(parseExplanation('{"formula": "elo-v2", ')).toBeNull()
    expect(parseExplanation(null)).toBeNull()
  })

  it('reads back what a rating stored', () => {
    const value = { formula: 'elo-v2', k: 46, margin: 1.1, expected: 0.5, opponent_before: 1500, classification: { completion: 'completed', sets: 'straight', source: 'parser' } }
    expect(parseExplanation(JSON.stringify(value))).toEqual(value)
  })
})

describe('pro set (CEO 14:29Z)', () => {
  it('a single pro set is classified "pro" and rated at 0.9, like a deciding set', () => {
    const c = classifyStoredScore('9-8(5)')
    expect(c).toEqual({ completion: 'completed', sets: 'pro', source: 'parser' })
    const o = rateMatch({ rating: 1500, ratedMatches: 10 }, { rating: 1500, ratedMatches: 10 }, c)
    expect([o.margin, o.winner.delta]).toEqual([0.9, 14])
  })
})
