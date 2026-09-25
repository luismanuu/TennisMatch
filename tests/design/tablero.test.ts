// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  EXAMPLE_MATCH, STAGE, clamp01, linger, plateDigits, scoreAfter, sectionProgress, smoothToward, stageAt, stepAt,
  type Side
} from '../../utils/tablero'
import { SEED, int, mulberry32, pick } from './prng'

const RUNS = 1500

/** Awkward numbers: edges, out of range, non-finite. */
const WEIRD = [0, 1, -0, -1e-12, 1 + 1e-12, 0.5, -5, 7, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const num = (rand: () => number, lo = -0.5, hi = 1.5) => (rand() < 0.15 ? pick(rand, WEIRD) : lo + rand() * (hi - lo))

/** Point sequences: empty, one point, one-sided, alternating (forces deuce and tiebreaks), random, very long. */
function points(rand: () => number): Side[] {
  switch (int(rand, 0, 5)) {
    case 0: return []
    case 1: return [pick(rand, ['a', 'b'] as const)]
    case 2: return Array.from({ length: int(rand, 0, 120) }, () => 'a' as Side)
    case 3: {
      // Alternate pairs of games: lands on 6–6 tiebreaks and long deuces
      const out: Side[] = []
      const n = int(rand, 0, 400)
      for (let i = 0; i < n; i++) out.push(i % 8 < 4 ? (i % 2 ? 'a' : 'b') : (i % 2 ? 'b' : 'a'))
      return out
    }
    case 4: {
      const bias = rand()
      return Array.from({ length: int(rand, 0, 500) }, () => (rand() < bias ? 'a' : 'b'))
    }
    default: return Array.from({ length: int(rand, 400, 1200) }, () => (rand() < 0.5 ? 'a' : 'b'))
  }
}

const validSet = ([a, b]: [number, number]) => {
  const [w, l] = a > b ? [a, b] : [b, a]
  return (w === 6 && l <= 4) || (w === 7 && (l === 5 || l === 6))
}

describe('scoreAfter (property)', () => {
  it('every completed set is a legal score and sets won match the set list', () => {
    const rand = mulberry32(SEED + 30)
    for (let i = 0; i < RUNS; i++) {
      const s = scoreAfter(points(rand))
      for (const set of s.sets) expect(validSet(set)).toBe(true)
      expect(s.setsWon[0]).toBe(s.sets.filter(([a, b]) => a > b).length)
      expect(s.setsWon[1]).toBe(s.sets.filter(([a, b]) => b > a).length)
      expect(s.sets.length).toBeLessThanOrEqual(3)
    }
  })

  it('a winner exists exactly when someone has two sets, and it is that player', () => {
    const rand = mulberry32(SEED + 31)
    for (let i = 0; i < RUNS; i++) {
      const s = scoreAfter(points(rand))
      const two = s.setsWon[0] === 2 ? 'a' : s.setsWon[1] === 2 ? 'b' : null
      expect(s.winner).toBe(two)
      if (s.winner) expect(s.points).toEqual(['', ''])
    }
  })

  it('the game in progress never shows a finished game, and labels come from the tennis vocabulary', () => {
    const rand = mulberry32(SEED + 32)
    const plain = new Set(['0', '15', '30', '40', 'AD'])
    for (let i = 0; i < RUNS; i++) {
      const s = scoreAfter(points(rand))
      if (s.winner) continue
      expect(s.games[0] <= 6 && s.games[1] <= 6).toBe(true)
      if (!s.tiebreak) {
        for (const p of s.points) expect(plain.has(p)).toBe(true)
        expect(s.points.filter(p => p === 'AD').length).toBeLessThanOrEqual(1)
        if (s.points.includes('AD')) expect(s.points).toContain('40')
      } else {
        expect(s.games).toEqual([6, 6])
        for (const p of s.points) expect(Number.isInteger(Number(p))).toBe(true)
      }
    }
  })

  it('adding points never takes games or sets away (prefix monotonicity), and points after the result change nothing', () => {
    const rand = mulberry32(SEED + 33)
    const progress = (s: ReturnType<typeof scoreAfter>) => s.sets.length * 100 + s.games[0] + s.games[1]
    for (let i = 0; i < 300; i++) {
      const seq = points(rand)
      let prev = -1
      let decided: ReturnType<typeof scoreAfter> | null = null
      for (let k = 0; k <= seq.length; k += int(rand, 1, 7)) {
        const s = scoreAfter(seq.slice(0, k))
        expect(progress(s)).toBeGreaterThanOrEqual(prev)
        prev = progress(s)
        if (decided) expect(s).toEqual(decided)
        else if (s.winner) decided = s
      }
    }
  })

  it('the example match ends 6–4, 6–3 to the first player (the landing\'s labelled score)', () => {
    const s = scoreAfter(EXAMPLE_MATCH)
    expect(s.winner).toBe('a')
    expect(s.sets).toEqual([[6, 4], [6, 3]])
    // No point is wasted after the match point: the scroll ends exactly on the result
    expect(scoreAfter(EXAMPLE_MATCH.slice(0, -1)).winner).toBeNull()
  })

  it('regression: deuce and advantage read 40–40 then AD–40, not 50 or a won game', () => {
    const deuce: Side[] = ['a', 'b', 'a', 'b', 'a', 'b']
    expect(scoreAfter(deuce).points).toEqual(['40', '40'])
    expect(scoreAfter([...deuce, 'b']).points).toEqual(['40', 'AD'])
    expect(scoreAfter([...deuce, 'b', 'a']).points).toEqual(['40', '40'])
    expect(scoreAfter([...deuce, 'a', 'a']).games).toEqual([1, 0])
  })

  it('regression: 6–6 goes to a tiebreak that ends 7–6, not 8–6', () => {
    const g = (w: Side): Side[] => [w, w, w, w]
    const to66: Side[] = []
    for (let k = 0; k < 6; k++) to66.push(...g('a'), ...g('b'))
    expect(scoreAfter(to66).tiebreak).toBe(true)
    const s = scoreAfter([...to66, 'a', 'a', 'a', 'a', 'a', 'a', 'a'])
    expect(s.sets).toEqual([[7, 6]])
  })
})

describe('motion curves (property)', () => {
  it('clamp01 always lands in [0, 1] and is the identity inside it', () => {
    const rand = mulberry32(SEED + 40)
    for (let i = 0; i < RUNS; i++) {
      const x = num(rand, -3, 3)
      const y = clamp01(x)
      expect(y >= 0 && y <= 1).toBe(true)
      if (Number.isFinite(x) && x >= 0 && x <= 1) expect(y === x).toBe(true) // -0 and +0 are the same position
    }
  })

  it('linger keeps both ends fixed and never runs backwards, for any amount', () => {
    const rand = mulberry32(SEED + 41)
    for (let i = 0; i < RUNS; i++) {
      const a = num(rand, -1, 2)
      expect(linger(0, a)).toBe(0)
      expect(linger(1, a)).toBe(1)
      const t1 = num(rand)
      const t2 = num(rand)
      const [lo, hi] = [clamp01(t1), clamp01(t2)].sort((x, y) => x - y) as [number, number]
      expect(linger(lo, a)).toBeLessThanOrEqual(linger(hi, a) + 1e-12)
      const y = linger(t1, a)
      expect(y >= 0 && y <= 1).toBe(true)
    }
  })

  it('linger slows the middle: the slope at 0.5 is below 1 for a positive amount', () => {
    const h = 1e-4
    expect((linger(0.5 + h, 0.5) - linger(0.5 - h, 0.5)) / (2 * h)).toBeLessThan(1)
  })

  it('stepAt is a whole step in [0, n], non-decreasing, and exactly n at the end', () => {
    const rand = mulberry32(SEED + 42)
    for (let i = 0; i < RUNS; i++) {
      const n = rand() < 0.1 ? pick(rand, [0, 1, Number.NaN, -3, 2.7]) : int(rand, 0, 400)
      const steps = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0))
      const a = num(rand)
      const b = num(rand)
      const sa = stepAt(a, n)
      expect(Number.isInteger(sa)).toBe(true)
      expect(sa >= 0 && sa <= steps).toBe(true)
      if (clamp01(a) <= clamp01(b)) expect(sa).toBeLessThanOrEqual(stepAt(b, n))
      expect(stepAt(1, n)).toBe(steps)
      expect(stepAt(0, n)).toBe(0)
    }
  })

  it('sectionProgress is 0..1 and grows as the section scrolls up', () => {
    const rand = mulberry32(SEED + 43)
    for (let i = 0; i < RUNS; i++) {
      const height = rand() < 0.1 ? pick(rand, [0, 1, Number.NaN]) : int(rand, 0, 5000)
      const vp = int(rand, 1, 1400)
      const t1 = int(rand, -6000, 2000)
      const t2 = t1 - int(rand, 0, 3000)
      const p1 = sectionProgress(t1, height, vp)
      const p2 = sectionProgress(t2, height, vp)
      expect(p1 >= 0 && p1 <= 1 && p2 >= 0 && p2 <= 1).toBe(true)
      expect(p2).toBeGreaterThanOrEqual(p1)
    }
  })

  it('smoothToward moves toward the target without overshooting, and reaches it', () => {
    const rand = mulberry32(SEED + 44)
    for (let i = 0; i < RUNS; i++) {
      const c = num(rand, -2, 2)
      const t = num(rand, -2, 2)
      const dt = pick(rand, [0, 1, 16.7, 33, 250, 5000, -10, Number.NaN])
      const next = smoothToward(c, t, dt, pick(rand, [0, 40, 90, 400]))
      if (!Number.isFinite(t)) { expect(next).toBe(Number.isFinite(c) ? c : t); continue }
      if (!Number.isFinite(c)) { expect(next).toBe(t); continue }
      const lo = Math.min(c, t) - 1e-12
      const hi = Math.max(c, t) + 1e-12
      expect(next >= lo && next <= hi).toBe(true)
      let x = c
      for (let k = 0; k < 400 && x !== t; k++) x = smoothToward(x, t, 16.7, 90)
      expect(x === t).toBe(true) // numeric equality: -0 and +0 are the same resting point
    }
  })

  it('regression: a NaN frame delta (first rAF tick) leaves the value in place instead of returning NaN', () => {
    expect(smoothToward(0.2, 0.8, Number.NaN, 90)).toBe(0.2)
    expect(smoothToward(0.2, 0.8, Number.NaN, 90)).not.toBeNaN()
  })

  it('plateDigits round-trips any non-negative integer and shows a dash for anything else', () => {
    const rand = mulberry32(SEED + 45)
    for (let i = 0; i < RUNS; i++) {
      const v = rand() < 0.2 ? pick(rand, [-1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined] as const) : int(rand, 0, 99999) + (rand() < 0.3 ? rand() : 0)
      const min = int(rand, 0, 6)
      const d = plateDigits(v as number, min)
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) { expect(d).toEqual(['–']); continue }
      expect(Number(d.join(''))).toBe(Math.floor(v))
      expect(d.length).toBe(Math.max(String(Math.floor(v)).length, Math.max(1, min)))
      for (const ch of d) expect(ch).toMatch(/^\d$/)
    }
  })
})

describe('stageAt: the landing board driven by scroll (property)', () => {
  it('scrolling further never un-plays points, un-confirms or un-climbs', () => {
    const rand = mulberry32(SEED + 50)
    for (let i = 0; i < RUNS; i++) {
      const a = clamp01(num(rand))
      const b = clamp01(num(rand))
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      const s = stageAt(lo)
      const t = stageAt(hi)
      expect(t.played).toBeGreaterThanOrEqual(s.played)
      expect(t.confirm).toBeGreaterThanOrEqual(s.confirm)
      expect(t.climb).toBeGreaterThanOrEqual(s.climb)
    }
  })

  it('nothing is confirmed before the match has a winner, and nothing climbs before it is confirmed', () => {
    const rand = mulberry32(SEED + 51)
    for (let i = 0; i < RUNS; i++) {
      const s = stageAt(num(rand))
      if (!s.match.winner) expect(s.confirm).toBe(0)
      if (s.confirm < 2) expect(s.climb).toBe(0)
      expect(s.played).toBe(Math.min(s.played, EXAMPLE_MATCH.length))
    }
  })

  it('starts on an empty board and ends on the confirmed 6–4, 6–3 with the climb finished', () => {
    const start = stageAt(0)
    expect(start.played).toBe(0)
    expect(start.match.sets).toEqual([])
    const end = stageAt(1)
    expect(end.match.winner).toBe('a')
    expect(end.confirm).toBe(2)
    expect(end.climb).toBe(1)
    // The match is over by the end of the play phase
    expect(stageAt(STAGE.play).match.winner).toBe('a')
  })
})
