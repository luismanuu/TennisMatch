import { describe, expect, it } from 'vitest'
import { ladderBars } from '../../utils/ladder'
import { SEED, int, mulberry32 } from './prng'

describe('ladderBars (property)', () => {
  it('stays inside the box, never overlaps, sits on the baseline, and rises monotonically to full height', () => {
    const rand = mulberry32(SEED + 40)
    for (let r = 0; r < 3000; r++) {
      const n = int(rand, -2, 40)
      const width = rand() < 0.05 ? 0 : int(rand, 1, 1200) + rand()
      const height = rand() < 0.05 ? 0 : int(rand, 1, 600) + rand()
      const gap = int(rand, -5, 80)
      const min = rand() * 1.4 - 0.2
      const bars = ladderBars(n, width, height, gap, min)
      if (n <= 0 || width <= 0 || height <= 0) { expect(bars).toEqual([]); continue }
      expect(bars).toHaveLength(Math.floor(n))
      const eps = 1e-9
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i]
        expect(b.w).toBeGreaterThan(0)
        expect(b.x).toBeGreaterThanOrEqual(-eps)
        expect(b.x + b.w).toBeLessThanOrEqual(width + 1e-6)
        expect(b.y + b.h).toBeCloseTo(height, 6)
        expect(b.h).toBeLessThanOrEqual(height + eps)
        expect(b.h).toBeGreaterThanOrEqual(-eps)
        if (i > 0) {
          expect(b.x).toBeGreaterThanOrEqual(bars[i - 1].x + bars[i - 1].w - 1e-6)
          expect(b.h).toBeGreaterThanOrEqual(bars[i - 1].h - eps)
        }
      }
      expect(bars[bars.length - 1].h).toBeCloseTo(height, 6)
    }
  })
})
