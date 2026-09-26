// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clamp01, sectionProgress, smoothToward } from '../../utils/tablero'
import { SEED, int, mulberry32, pick } from './prng'

const RUNS = 1500

/** Awkward numbers: edges, out of range, non-finite. */
const WEIRD = [0, 1, -0, -1e-12, 1 + 1e-12, 0.5, -5, 7, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const num = (rand: () => number, lo = -0.5, hi = 1.5) => (rand() < 0.15 ? pick(rand, WEIRD) : lo + rand() * (hi - lo))

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

})
