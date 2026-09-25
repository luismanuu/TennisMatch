import { describe, expect, it } from 'vitest'
import { COURT, arcControl, arcPath, courtSegments, quadAt } from '../../utils/court'
import { SEED, int, mulberry32 } from './prng'

const RUNS = 1500
const box = (rand: () => number) => {
  const width = int(rand, 0, 2000) + (rand() < 0.1 ? 0 : rand())
  const height = int(rand, 0, 1200) + (rand() < 0.1 ? 0 : rand())
  const pad = rand() < 0.2 ? 0 : int(rand, 0, 60)
  return { width, height, pad }
}

describe('courtSegments (property)', () => {
  it('every endpoint stays inside the padded box and the court is mirror-symmetric', () => {
    const rand = mulberry32(SEED + 10)
    for (let i = 0; i < RUNS; i++) {
      const { width, height, pad } = box(rand)
      const segs = courtSegments(width, height, pad)
      expect(segs).toHaveLength(10)
      const w = Math.max(0, width - 2 * pad)
      const h = Math.max(0, height - 2 * pad)
      const eps = 1e-9
      const xs = segs.flatMap(s => [s.x1, s.x2])
      const ys = segs.flatMap(s => [s.y1, s.y2])
      for (const x of xs) { expect(x).toBeGreaterThanOrEqual(pad - eps); expect(x).toBeLessThanOrEqual(pad + w + eps) }
      for (const y of ys) { expect(y).toBeGreaterThanOrEqual(pad - eps); expect(y).toBeLessThanOrEqual(pad + h + eps) }
      // Mirror across the net: each x has a partner at (2·netX − x)
      const netX = pad + w / 2
      for (const x of xs) expect(xs.some(o => Math.abs(o - (2 * netX - x)) < 1e-6)).toBe(true)
      // Mirror across the center line
      const midY = pad + h / 2
      for (const y of ys) expect(ys.some(o => Math.abs(o - (2 * midY - y)) < 1e-6)).toBe(true)
    }
  })

  it('service lines sit 21/78 of the court length from the net (regulation ratio)', () => {
    const segs = courtSegments(780, 360, 0)
    const verticals = segs.filter(s => s.x1 === s.x2).map(s => s.x1).sort((a, b) => a - b)
    expect(verticals).toEqual([0, 180, 390, 600, 780])
    expect((390 - 180) / 780).toBeCloseTo(COURT.service / COURT.length, 10)
  })
})

describe('shot arc (property)', () => {
  it('starts and ends on the given points and peaks exactly `lift` above the higher endpoint', () => {
    const rand = mulberry32(SEED + 11)
    for (let i = 0; i < RUNS; i++) {
      const from = { x: int(rand, -500, 1500) + rand(), y: int(rand, -500, 1500) + rand() }
      const to = { x: int(rand, -500, 1500) + rand(), y: int(rand, -500, 1500) + rand() }
      const lift = rand() < 0.1 ? 0 : int(rand, 0, 400) + rand()
      const c = arcControl(from, to, lift)
      const top = Math.min(from.y, to.y) - lift
      expect(quadAt(from, c, to, 0)).toEqual(from)
      const end = quadAt(from, c, to, 1)
      expect(end.x).toBeCloseTo(to.x, 9); expect(end.y).toBeCloseTo(to.y, 9)
      let minY = Infinity
      for (let k = 0; k <= 400; k++) minY = Math.min(minY, quadAt(from, c, to, k / 400).y)
      expect(minY).toBeGreaterThanOrEqual(top - 1e-6)
      expect(minY - top).toBeLessThan(Math.max(1e-6, 0.02 * (lift + Math.abs(from.y - to.y) + 1)))
    }
  })

  it('negative lift is treated as zero, never as a downward dip', () => {
    const rand = mulberry32(SEED + 12)
    for (let i = 0; i < 300; i++) {
      const from = { x: 0, y: int(rand, 0, 500) }
      const to = { x: 100, y: int(rand, 0, 500) }
      const c = arcControl(from, to, -int(rand, 1, 300))
      let maxY = -Infinity
      for (let k = 0; k <= 100; k++) maxY = Math.max(maxY, quadAt(from, c, to, k / 100).y)
      expect(maxY).toBeLessThanOrEqual(Math.max(from.y, to.y) + 1e-9)
    }
  })

  it('arcPath is a well-formed quadratic path beginning at `from`', () => {
    expect(arcPath({ x: 706, y: 296 }, { x: 280, y: 160 }, 110)).toMatch(/^M706 296 Q[-\d.]+ [-\d.]+ 280 160$/)
  })
})
