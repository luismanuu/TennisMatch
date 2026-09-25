import { describe, expect, it } from 'vitest'
import { MIN_LABEL_GAP, buildEloChart, eloDomain, type HistoryEntry } from '../../utils/eloChart'
import { SEED, int, mulberry32 } from './prng'

const BOX = { width: 400, height: 200, padding: { top: 20, right: 20, bottom: 30, left: 50 } }
const utcDay = (iso: string) => iso.slice(0, 10)

function history(rand: () => number): HistoryEntry[] {
  const n = rand() < 0.08 ? 0 : rand() < 0.1 ? 1 : int(rand, 2, 60)
  let elo = int(rand, 1, 5000)
  const start = Date.UTC(2025, int(rand, 0, 11), int(rand, 1, 28))
  return Array.from({ length: n }, () => {
    const before = elo
    elo = Math.max(1, elo + int(rand, -60, 60))
    // Out-of-order timestamps and many matches on one day are both normal input
    const t = start + int(rand, 0, 120) * 86400000 + int(rand, 0, 86399) * 1000
    return { elo_before: before, elo_after: elo, created_at: new Date(t).toISOString() }
  })
}

describe('buildEloChart (property)', () => {
  it('plots every entry inside the plot area, left to right in time, with higher SR drawn higher', () => {
    const rand = mulberry32(SEED + 50)
    for (let r = 0; r < 800; r++) {
      const h = history(rand)
      const { points, line, area, yTicks, xLabels, domain } = buildEloChart(h, BOX, utcDay)
      for (let i = 1; i < xLabels.length; i++) expect(xLabels[i].x - xLabels[i - 1].x).toBeGreaterThanOrEqual(MIN_LABEL_GAP)
      if (points.length) expect(xLabels[xLabels.length - 1].date).toBe(points.filter(p => p.dayIndex === points[points.length - 1].dayIndex)[0].date)
      expect(points).toHaveLength(h.length)
      const { left, right, top, bottom } = BOX.padding
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(left - 1e-9)
        expect(p.x).toBeLessThanOrEqual(BOX.width - right + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(top - 1e-9)
        expect(p.y).toBeLessThanOrEqual(BOX.height - bottom + 1e-9)
        expect(p.elo).toBeGreaterThanOrEqual(domain.min)
        expect(p.elo).toBeLessThanOrEqual(domain.max)
      }
      for (let i = 1; i < points.length; i++) {
        expect(new Date(points[i].date).getTime()).toBeGreaterThanOrEqual(new Date(points[i - 1].date).getTime())
        if (points[i].dayIndex > points[i - 1].dayIndex) expect(points[i].x).toBeGreaterThan(points[i - 1].x - 1e-9)
      }
      for (let i = 0; i < points.length; i++) for (let j = 0; j < points.length; j += 7) {
        if (points[i].elo > points[j].elo) expect(points[i].y).toBeLessThan(points[j].y)
      }
      expect(yTicks[0].value).toBe(domain.max)
      expect(yTicks[4].value).toBe(domain.min)
      if (points.length) {
        expect(line.startsWith('M')).toBe(true)
        expect((line.match(/[ML]/g) || []).length).toBe(points.length)
        expect(area.endsWith('Z')).toBe(true)
      } else {
        expect(line).toBe('')
        expect(area).toBe('')
      }
    }
  })

  it('ignores entries with a non-finite SR or an unparseable date instead of drawing NaN', () => {
    const { points, line } = buildEloChart([
      { elo_before: 1, elo_after: Number.NaN, created_at: '2026-01-01T00:00:00Z' },
      { elo_before: 1, elo_after: 1500, created_at: 'not a date' },
      { elo_before: 1480, elo_after: 1500, created_at: '2026-01-02T00:00:00Z' }
    ], BOX, utcDay)
    expect(points).toHaveLength(1)
    expect(line).not.toMatch(/NaN/)
  })
})

describe('eloDomain (property)', () => {
  it('brackets every value with at least 50 SR of room, on multiples of 50', () => {
    const rand = mulberry32(SEED + 51)
    for (let r = 0; r < 3000; r++) {
      const xs = Array.from({ length: int(rand, 1, 30) }, () => int(rand, -100, 6000))
      const { min, max } = eloDomain(xs)
      expect(Math.abs(min % 50)).toBe(0)
      expect(Math.abs(max % 50)).toBe(0)
      expect(Math.min(...xs) - min).toBeGreaterThanOrEqual(50)
      expect(max - Math.max(...xs)).toBeGreaterThanOrEqual(50)
    }
  })
})
