// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  CHAPTERS, CLAY, DRAW, DRAW_TOTAL, FADE, FLOOD_FULL, MOTES, NET, NET_SWAY, SHOTS, TENNIS_COURT as C, cameraAt, chapterLocal, chaptersAt, clayAt,
  countUp, courtTier, easeInOut, lightAt, lineDraw, motePosition, motesAt, netSettle, projectPoint, sweepAt,
  type CourtTier, type DeviceSignals, type Vec3
} from '../../utils/courtShot'
import { SEED, int, mulberry32, pick } from './prng'

const RUNS = 1500
const WEIRD = [0, 1, -0, -1e-12, 1 + 1e-12, 0.5, -5, 7, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const num = (rand: () => number, lo = -0.5, hi = 1.5) => (rand() < 0.15 ? pick(rand, WEIRD) : lo + rand() * (hi - lo))
const finite = (v: readonly number[]) => v.every(Number.isFinite)
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const corners: Vec3[] = [
  [-C.doubles / 2, 0, C.half], [C.doubles / 2, 0, C.half], [-C.doubles / 2, 0, -C.half], [C.doubles / 2, 0, -C.half],
  [-C.postX, C.netPost, 0], [C.postX, C.netPost, 0]
]
const onScreen = (pt: Vec3, cam: ReturnType<typeof cameraAt>, aspect: number) => {
  const [x, y, depth] = projectPoint(pt, cam, aspect)
  return depth > 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1
}

describe('cameraAt: the court as the object (property)', () => {
  it('any input: a finite camera above the court, a sane lens', () => {
    const rand = mulberry32(SEED + 70)
    for (let i = 0; i < RUNS; i++) {
      const cam = cameraAt(num(rand), num(rand, 0, 4))
      expect(finite([...cam.position, ...cam.target, cam.fov])).toBe(true)
      expect(cam.position[1]).toBeGreaterThan(3)
      expect(cam.fov).toBeGreaterThanOrEqual(32)
      expect(cam.fov).toBeLessThanOrEqual(60)
    }
  })

  it('the whole court and both net posts stay in shot, all the way, at any phone or desktop aspect', () => {
    const rand = mulberry32(SEED + 71)
    for (let i = 0; i < RUNS; i++) {
      const aspect = 0.45 + rand() * 2.15
      const cam = cameraAt(rand(), aspect)
      for (const c of corners) expect(onScreen(c, cam, aspect)).toBe(true)
    }
  })

  it('moves continuously with scroll (no cuts) and holds still inside a held shot', () => {
    const rand = mulberry32(SEED + 72)
    for (let i = 0; i < RUNS; i++) {
      const aspect = 0.45 + rand() * 2.15
      const p = rand()
      const e = 1e-4
      expect(dist(cameraAt(p, aspect).position, cameraAt(p + e, aspect).position)).toBeLessThan(3000 * e)
    }
    const held = SHOTS[0]!.p + 0.5 * (SHOTS[1]!.p - SHOTS[0]!.p)
    expect(cameraAt(held, 1.6)).toEqual(cameraAt(0, 1.6))
    expect(cameraAt(0.95, 1.6)).toEqual(cameraAt(1, 1.6))
  })

  it('differential: projectPoint agrees with three.js PerspectiveCamera', () => {
    const rand = mulberry32(SEED + 73)
    for (let i = 0; i < 400; i++) {
      const aspect = 0.45 + rand() * 2.15
      const cam = cameraAt(rand(), aspect)
      const three = new PerspectiveCamera(cam.fov, aspect, 0.1, 1000)
      three.position.set(...cam.position)
      three.lookAt(...cam.target)
      three.updateMatrixWorld()
      // The same lens shift the scene applies (lib/court/courtScene.ts)
      three.projectionMatrix.elements[8] = -cam.shift[0]
      three.projectionMatrix.elements[9] = -cam.shift[1]
      const pt: Vec3 = [-15 + 30 * rand(), 4 * rand(), -20 + 40 * rand()]
      const ours = projectPoint(pt, cam, aspect)
      if (!(ours[2] > 0.5)) continue
      const v = new Vector3(...pt).project(three)
      expect(ours[0]).toBeCloseTo(v.x, 6)
      expect(ours[1]).toBeCloseTo(v.y, 6)
    }
  })
})

describe('easeInOut (property)', () => {
  it('fixed ends, stays in [0, 1], never runs backwards, flat at both ends', () => {
    const rand = mulberry32(SEED + 74)
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    for (let i = 0; i < RUNS; i++) {
      const a = num(rand), b = num(rand)
      const [lo, hi] = [a, b].map(x => (Number.isFinite(x) ? x : 0)).sort((x, y) => x - y) as [number, number]
      const y = easeInOut(a)
      expect(y >= 0 && y <= 1).toBe(true)
      expect(easeInOut(lo)).toBeLessThanOrEqual(easeInOut(hi) + 1e-12)
    }
    const h = 1e-4
    expect(easeInOut(h) / h).toBeLessThan(1e-3)
    expect((1 - easeInOut(1 - h)) / h).toBeLessThan(1e-3)
  })
})

describe('lightAt: the floodlights power on one by one (property)', () => {
  it('scrolling on never dims a tower, never brings daylight back, never lowers exposure', () => {
    const rand = mulberry32(SEED + 75)
    for (let i = 0; i < RUNS; i++) {
      const a = rand(), b = rand()
      const [lo, hi] = a < b ? [a, b] : [b, a]
      const x = lightAt(lo), y = lightAt(hi)
      x.lamps.forEach((l, k) => expect(y.lamps[k]!).toBeGreaterThanOrEqual(l - 1e-12))
      expect(y.dusk).toBeLessThanOrEqual(x.dusk + 1e-12)
      expect(y.exposure).toBeGreaterThanOrEqual(x.exposure - 1e-12)
    }
  })

  it('towers come on in order: a tower is never brighter than the one before it', () => {
    const rand = mulberry32(SEED + 76)
    for (let i = 0; i < RUNS; i++) {
      const l = lightAt(num(rand))
      expect(finite([...l.lamps, l.flood, l.dusk, l.exposure])).toBe(true)
      for (let k = 1; k < 4; k++) expect(l.lamps[k]!).toBeLessThanOrEqual(l.lamps[k - 1]! + 1e-12)
      for (const v of [...l.lamps, l.flood, l.dusk]) expect(v >= 0 && v <= 1).toBe(true)
    }
    expect(lightAt(0).flood).toBe(0)
    expect(lightAt(FLOOD_FULL).flood).toBe(1)
    expect(lightAt(1).dusk).toBe(0)
  })

  it('the sweep is only there while the towers power on, and stays on the court', () => {
    const rand = mulberry32(SEED + 84)
    for (let i = 0; i < RUNS; i++) {
      const p = num(rand)
      const s = sweepAt(p)
      expect(s.at >= 0 && s.at <= 1 && s.strength >= 0 && s.strength <= 1).toBe(true)
      const l = lightAt(p)
      if (l.flood === 0 || l.flood === 1) expect(s.strength).toBe(0)
    }
  })
})

describe('clay, net and motes: one moment per chapter (property)', () => {
  it('the resurfacing is monotonic and happens inside the confirmation chapter', () => {
    const rand = mulberry32(SEED + 85)
    for (let i = 0; i < RUNS; i++) {
      const a = rand(), b = rand()
      const [lo, hi] = a < b ? [a, b] : [b, a]
      expect(clayAt(hi)).toBeGreaterThanOrEqual(clayAt(lo) - 1e-12)
      const c = clayAt(num(rand))
      expect(c >= 0 && c <= 1).toBe(true)
    }
    expect(clayAt(CLAY.start)).toBe(0)
    expect(clayAt(CLAY.end)).toBe(1)
    expect(CLAY.start).toBeGreaterThan(CHAPTERS[1]!.to)
    expect(CLAY.end).toBeLessThanOrEqual(CHAPTERS[2]!.to)
  })

  it('the net sways less than NET_SWAY, starts and ends at rest, and is continuous', () => {
    const rand = mulberry32(SEED + 86)
    for (let i = 0; i < RUNS; i++) {
      const p = num(rand)
      const v = netSettle(p)
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.abs(v)).toBeLessThanOrEqual(NET_SWAY)
      const q = rand(), e = 1e-5
      expect(Math.abs(netSettle(q + e) - netSettle(q))).toBeLessThan(NET_SWAY * 40 * e / (NET.end - NET.start) + 1e-12)
    }
    expect(netSettle(NET.start)).toBe(0)
    expect(netSettle(NET.end)).toBe(0)
  })

  it('motes stay inside their tower beam and above the court, for any scroll', () => {
    const rand = mulberry32(SEED + 87)
    const tower = { x: 12, z: 18, h: 24 }
    for (let i = 0; i < RUNS; i++) {
      const [x, y, z] = motePosition(int(rand, 0, 5000), num(rand), tower)
      expect(finite([x, y, z])).toBe(true)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(tower.h)
      const t = y / tower.h
      expect(Math.hypot(x - tower.x * t, z - tower.z * t)).toBeLessThanOrEqual(5.5 * (1 - t) + 0.4 + 1e-9)
    }
    expect(motesAt(MOTES.start)).toBe(0)
    expect(motesAt(1)).toBe(1)
  })
})

describe('lineDraw: the chalk lines draw themselves once (property)', () => {
  it('each line is 0 before its turn, grows monotonically, is 1 after DRAW_TOTAL, and never ahead of the line before it', () => {
    const rand = mulberry32(SEED + 88)
    for (let i = 0; i < RUNS; i++) {
      const t1 = num(rand, -200, DRAW_TOTAL + 200), t2 = num(rand, -200, DRAW_TOTAL + 200)
      const [lo, hi] = [t1, t2].map(x => (Number.isFinite(x) ? x : 0)).sort((x, y) => x - y) as [number, number]
      for (let k = 0; k < 11; k++) {
        const v = lineDraw(k, t1)
        expect(v >= 0 && v <= 1).toBe(true)
        expect(lineDraw(k, hi)).toBeGreaterThanOrEqual(lineDraw(k, lo) - 1e-12)
        if (k > 0) expect(lineDraw(k, t1)).toBeLessThanOrEqual(lineDraw(k - 1, t1) + 1e-12)
      }
    }
    for (let k = 0; k < 11; k++) { expect(lineDraw(k, 0)).toBe(0); expect(lineDraw(k, DRAW_TOTAL)).toBe(1) }
    expect(DRAW.delay).toBeGreaterThanOrEqual(0)
  })
})

describe('chaptersAt: large type revealing alongside the camera (property)', () => {
  it('every chapter is 0..1, and two chapters are never visible at once', () => {
    const rand = mulberry32(SEED + 77)
    for (let i = 0; i < RUNS; i++) {
      const v = chaptersAt(num(rand))
      expect(v).toHaveLength(CHAPTERS.length)
      for (const x of v) expect(x >= 0 && x <= 1).toBe(true)
      expect(v.filter(x => x > 0).length).toBeLessThanOrEqual(1)
    }
  })

  it('each chapter is fully shown across its hold, the first at rest and the last at the end', () => {
    const rand = mulberry32(SEED + 78)
    CHAPTERS.forEach((c, k) => {
      for (let i = 0; i < 200; i++) expect(chaptersAt(c.from + rand() * (c.to - c.from))[k]).toBe(1)
    })
    expect(chaptersAt(0)[0]).toBe(1)
    expect(chaptersAt(1).at(-1)).toBe(1)
  })

  it('continuous: a small scroll is a small change in every chapter (no pops)', () => {
    const rand = mulberry32(SEED + 79)
    for (let i = 0; i < RUNS; i++) {
      const p = rand(), e = 1e-5
      const a = chaptersAt(p), b = chaptersAt(p + e)
      a.forEach((x, k) => expect(Math.abs(x - b[k]!)).toBeLessThan((2 / FADE) * e + 1e-9))
    }
  })

  it('holds and fades never overlap in the shipped timeline', () => {
    for (let k = 1; k < CHAPTERS.length; k++) expect(CHAPTERS[k - 1]!.to + FADE).toBeLessThanOrEqual(CHAPTERS[k]!.from - FADE + 1e-12)
  })
})

describe('chapterLocal (property)', () => {
  it('0..1, monotonic, 0 before a chapter arrives and 1 once it starts to leave', () => {
    const rand = mulberry32(SEED + 89)
    for (let i = 0; i < RUNS; i++) {
      const k = int(rand, 0, CHAPTERS.length - 1)
      const a = rand(), b = rand()
      const [lo, hi] = a < b ? [a, b] : [b, a]
      const v = chapterLocal(num(rand), k)
      expect(v >= 0 && v <= 1).toBe(true)
      expect(chapterLocal(hi, k)).toBeGreaterThanOrEqual(chapterLocal(lo, k))
    }
    expect(chapterLocal(CHAPTERS[1]!.to, 1)).toBe(1)
    expect(chapterLocal(CHAPTERS[1]!.from - FADE, 1)).toBe(0)
    expect(chapterLocal(0.5, 99)).toBe(0)
  })
})

describe('countUp: the SR arriving (property)', () => {
  it('whole numbers, between the ends, never backwards, exactly the target at the end', () => {
    const rand = mulberry32(SEED + 80)
    for (let i = 0; i < RUNS; i++) {
      const from = rand() < 0.1 ? pick(rand, [Number.NaN, 0, -3]) : int(rand, 0, 5000)
      const to = rand() < 0.1 ? pick(rand, [Number.NaN, 0, 1]) : int(rand, 0, 5000)
      const a = Math.round(Number.isFinite(from) ? from : 0), b = Math.round(Number.isFinite(to) ? to : 0)
      const t1 = num(rand), t2 = num(rand)
      const [lo, hi] = [t1, t2].map(x => (Number.isFinite(x) ? x : 0)).sort((x, y) => x - y) as [number, number]
      const v = countUp(from, to, t1)
      expect(Number.isInteger(v)).toBe(true)
      expect(v >= Math.min(a, b) && v <= Math.max(a, b)).toBe(true)
      const [x, y] = [countUp(from, to, lo), countUp(from, to, hi)]
      if (b >= a) expect(y).toBeGreaterThanOrEqual(x)
      else expect(y).toBeLessThanOrEqual(x)
      expect(countUp(from, to, 1)).toBe(b)
      expect(countUp(from, to, 0)).toBe(a)
    }
  })
})

describe('courtTier: who gets the 3D court (property)', () => {
  const signals = (rand: () => number): DeviceSignals => ({
    webgl: rand() < 0.85,
    software: rand() < 0.1 ? true : rand() < 0.5 ? false : undefined,
    reducedMotion: rand() < 0.1,
    saveData: rand() < 0.1 ? true : undefined,
    deviceMemory: rand() < 0.3 ? undefined : pick(rand, [0.25, 0.5, 1, 2, 4, 8, 16]),
    cores: rand() < 0.2 ? undefined : int(rand, 1, 16),
    effectiveType: rand() < 0.3 ? pick(rand, ['slow-2g', '2g', '3g', '4g']) : undefined,
    override: rand() < 0.15 ? pick(rand, ['full', 'lite', 'static', null] as const) : undefined
  })
  const rank: Record<CourtTier, number> = { static: 0, lite: 1, full: 2 }

  it('reduced motion or no WebGL always keeps the static poster', () => {
    const rand = mulberry32(SEED + 81)
    for (let i = 0; i < RUNS; i++) {
      const s = signals(rand)
      if (s.reducedMotion || !s.webgl) expect(courtTier(s)).toBe('static')
    }
  })

  it('more memory or more cores never lowers the tier', () => {
    const rand = mulberry32(SEED + 82)
    for (let i = 0; i < RUNS; i++) {
      const s = signals(rand)
      const more = { ...s, deviceMemory: s.deviceMemory === undefined ? undefined : s.deviceMemory * 2, cores: s.cores === undefined ? undefined : s.cores + int(rand, 1, 8) }
      expect(rank[courtTier(more)]).toBeGreaterThanOrEqual(rank[courtTier(s)])
    }
  })

  it('without an override: software GL, Data Saver, 2G, <4 GB or <4 cores stays static', () => {
    const rand = mulberry32(SEED + 83)
    for (let i = 0; i < RUNS; i++) {
      const s = { ...signals(rand), override: undefined }
      const weak = s.software || s.saveData || s.effectiveType === '2g' || s.effectiveType === 'slow-2g' ||
        (s.deviceMemory !== undefined && s.deviceMemory < 4) || (s.cores !== undefined && s.cores < 4)
      if (weak) expect(courtTier(s)).toBe('static')
    }
  })

  it('regression: Safari/Firefox (memory and cores unknown) with hardware WebGL get the full court', () => {
    expect(courtTier({ webgl: true, software: false, reducedMotion: false })).toBe('full')
  })
})
