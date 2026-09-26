// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { checkWinner, parseScore, renderScore, scoreWinner, setWinner, type ParsedScore, type SetScore } from '../utils/score'

// The score parser (utils/score.ts) is the only gate a result passes before it is stored and rated.
const SEED = 20260926
const RUNS = 3000

const flip = (s: SetScore): SetScore => ({ ...s, p1: s.p2, p2: s.p1 })
const wonSet = fc.oneof(
  fc.integer({ min: 0, max: 4 }).map((l): SetScore => ({ p1: 6, p2: l })),
  fc.constant<SetScore>({ p1: 7, p2: 5 }),
  fc.constant<SetScore>({ p1: 7, p2: 6 }),
  fc.integer({ min: 0, max: 30 }).map((tb): SetScore => ({ p1: 7, p2: 6, tiebreak: tb })),
)
const matchTiebreak = fc.oneof(
  fc.integer({ min: 0, max: 8 }).map((l): SetScore => ({ p1: 10, p2: l, matchTiebreak: true })),
  fc.integer({ min: 11, max: 30 }).map((w): SetScore => ({ p1: w, p2: w - 2, matchTiebreak: true })),
)
// A set in progress when a player retired: games only, not a finished set
const partialSet = fc
  .tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 }))
  .map(([a, b]): SetScore => ({ p1: a, p2: b }))
  .filter((s) => setWinner(s) === null)

// A valid completed best-of-3, from player 1's side, won by `winner`
const completed = fc
  .record({ p1Wins: fc.boolean(), sets: fc.constantFrom(2, 3), first: wonSet, second: wonSet, third: fc.oneof(wonSet, matchTiebreak), loserFirst: fc.boolean() })
  .map(({ p1Wins, sets, first, second, third, loserFirst }): ParsedScore => {
    const forWinner = (s: SetScore) => (p1Wins ? s : flip(s))
    const forLoser = (s: SetScore) => (p1Wins ? flip(s) : s)
    const list = sets === 2
      ? [forWinner(first), forWinner(second)]
      : loserFirst
        ? [forLoser(first), forWinner(second), forWinner(third)]
        : [forWinner(first), forLoser(second), forWinner(third)]
    return { sets: list, completion: 'completed' }
  })
const retired = fc
  .record({ done: fc.array(fc.tuple(wonSet, fc.boolean()), { minLength: 0, maxLength: 2 }), partial: fc.option(partialSet, { nil: undefined }) })
  .map(({ done, partial }): ParsedScore => {
    const sets = done.map(([s, p1Took]) => (p1Took ? s : flip(s)))
    if (partial) sets.push(partial)
    return { sets, completion: 'retired' }
  })
  .filter((s) => s.sets.length > 0 && s.sets.filter((x) => setWinner(x) === 'p1').length < 2 && s.sets.filter((x) => setWinner(x) === 'p2').length < 2)
// A whole match as one pro set, to 8 or to 10, from player 1's side
const proSet = fc
  .record({
    to: fc.constantFrom(8 as const, 10 as const),
    kind: fc.constantFrom('clear', 'byTwo', 'tiebreak'),
    lo: fc.nat(),
    tb: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }),
    p1Wins: fc.boolean(),
  })
  .map(({ to, kind, lo, tb, p1Wins }): ParsedScore => {
    const [w, l] = kind === 'clear' ? [to, lo % (to - 1)] : kind === 'byTwo' ? [to + 1, to - 1] : [to + 1, to]
    const set: SetScore = { p1: p1Wins ? w : l, p2: p1Wins ? l : w, proSet: to }
    if (kind === 'tiebreak' && tb !== undefined) set.tiebreak = tb
    return { sets: [set], completion: 'completed' }
  })
const anyValid = fc.oneof(completed, completed, proSet, retired, fc.constant<ParsedScore>({ sets: [], completion: 'walkover' }))

describe('parseScore / renderScore: properties', () => {
  it('round-trip: parse(render(x)) == x for every valid score', () => {
    fc.assert(
      fc.property(anyValid, (score) => {
        const parsed = parseScore(renderScore(score))
        expect(parsed).toEqual({ ok: true, score })
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('canonical: any accepted spelling renders to one text, and that text parses to the same score', () => {
    const spelling = fc.record({ sep: fc.constantFrom(' ', ', ', ',', ' , ', ';  '), dash: fc.constantFrom('-', ' - ', '- '), upper: fc.boolean() })
    fc.assert(
      fc.property(anyValid, spelling, (score, { sep, dash, upper }) => {
        const canonical = renderScore(score)
        let text = canonical.replace(/ (?!ret\.)/g, sep).replace(/-/g, dash)
        if (upper) text = text.toUpperCase()
        const parsed = parseScore(text)
        expect(parsed.ok).toBe(true)
        if (parsed.ok) expect(renderScore(parsed.score)).toBe(canonical)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('a completed score agrees with exactly one winner: the side that took two sets, or the pro set', () => {
    fc.assert(
      fc.property(fc.oneof(completed, proSet), (score) => {
        const winner = scoreWinner(score)!
        expect(checkWinner(score, winner)).toBeNull()
        expect(checkWinner(score, winner === 'p1' ? 'p2' : 'p1')).not.toBeNull()
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('rejects every set that is not a finished set in a completed match', () => {
    const notASet = fc
      .tuple(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 15 }))
      .filter(([a, b]) => setWinner({ p1: a, p2: b }) === null)
    fc.assert(
      fc.property(notASet, wonSet, fc.boolean(), ([a, b], other, badFirst) => {
        const bad = `${a}-${b}`
        const good = `${other.p1}-${other.p2}`
        const text = badFirst ? `${bad} ${good}` : `${good} ${bad}`
        expect(parseScore(text).ok).toBe(false)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('never throws, whatever the text', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.stringMatching(/^[0-9\-\s(),\[\]retabdwoRETABDWO./]{0,40}$/)), (text) => {
        const parsed = parseScore(text)
        if (parsed.ok) expect(parseScore(renderScore(parsed.score))).toEqual(parsed)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})

// Named regressions: S5 in the audit (free text was stored and rated as is)
describe('named regressions: scores the old free-text field accepted', () => {
  it.each([
    ['banana'],
    ['7-7 6-3'], // 7-7 is not a set
    ['6-5 6-3'], // 6-5 without a tiebreak is not a set
    ['6-4'], // one set is not a best of 3
    ['6-4 6-4 6-4'], // a third set after 2-0
    ['6-4 3-6'], // 1-1 with no third set and no "ret."
    ['6-4 6-4 ret.'], // decided, yet marked retired
    ['10-8 6-4 6-4'], // a match tiebreak as the first set
    ['6-4 6-3(5)'], // a tiebreak on a 6-3 set
    ['8-7'], // pro set: 8-7 is not final (play on to 9-7, or a tiebreak at 8-8)
    ['9-9'],
    ['10-9'],
    ['12-10'],
    ['8-6(5)'], // a tiebreak on an 8-6 pro set
    ['9-7 6-4'], // a pro-set score as one of several sets
    [''],
  ])('rejects %j', (text) => {
    expect(parseScore(text).ok).toBe(false)
  })

  it('rejects a score that contradicts the winner: "6-0 6-0" (player 1 took every game) with player 2 as winner', () => {
    const parsed = parseScore('6-0 6-0')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(checkWinner(parsed.score, 'p2')).toMatch(/no coincide con el ganador/)
  })

  it.each([
    ['6-4, 6-3', '6-4 6-3'],
    ['6-4 3-6 7-6 (7-5)', '6-4 3-6 7-6(5)'],
    ['6-4 3-6 [10-8]', '6-4 3-6 10-8'],
    ['6-4 2-1 RET', '6-4 2-1 ret.'],
    ['w/o', 'W/O'],
    ['6-4 5-5 abd', '6-4 5-5 abd.'],
    ['6/4 6/3', '6-4 6-3'], // slash spelling (review finding)
    ['6\u20134 6\u20133', '6-4 6-3'], // en dash
    ['6-4 2-1 rtd', '6-4 2-1 ret.'],
    ['Walkover', 'W/O'], // what the tournament withdraw route stored
    ['8-6', '8-6'], // pro sets (CEO 14:29Z)
    ['9-7', '9-7'],
    ['9-8 (7-5)', '9-8(5)'],
    ['10-8', '10-8'],
    ['11-9', '11-9'],
    ['11-10(3)', '11-10(3)'],
  ])('accepts %j as %j', (text, canonical) => {
    const parsed = parseScore(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(renderScore(parsed.score)).toBe(canonical)
  })

  it('a pro set agrees only with the side that won it: "8-6" won by player 2 is refused', () => {
    const parsed = parseScore('8-6')
    expect(parsed.ok && parsed.score.sets[0].proSet).toBe(8)
    if (parsed.ok) {
      expect(checkWinner(parsed.score, 'p1')).toBeNull()
      expect(checkWinner(parsed.score, 'p2')).toMatch(/no coincide con el ganador/)
    }
  })

  it('an invalid pro set explains the pro-set format', () => {
    expect(parseScore('8-7')).toEqual({ ok: false, error: expect.stringMatching(/pro set a 8/) })
  })

  it('an abandoned match is never a result', () => {
    const parsed = parseScore('6-4 5-5 abd.')
    expect(parsed.ok && checkWinner(parsed.score, 'p1')).toMatch(/abandonado/)
  })
})
