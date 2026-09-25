// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  DRAG_LIMIT, TENNIS_COURT, ballAt, cameraAt, courtTier, netHeight, planMatch, planPoint, projectPoint, rallyAt,
  sheenAt, sheenFromTilt, trailPoints, type CourtTier, type DeviceSignals, type Shot, type Vec3
} from '../../utils/broadcast'
import { EXAMPLE_MATCH, STAGE, stageAt, type Side } from '../../utils/tablero'
import { SEED, int, mulberry32, pick } from './prng'

const RUNS = 1500
const WEIRD = [0, 1, -0, -1e-12, 1 + 1e-12, 0.5, -5, 7, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const num = (rand: () => number, lo = -0.5, hi = 1.5) => (rand() < 0.15 ? pick(rand, WEIRD) : lo + rand() * (hi - lo))
const vec = (rand: () => number, y = true): Vec3 => [num(rand, -12, 12), y ? Math.abs(num(rand, 0, 3)) || 0 : 0, num(rand, -18, 18)]
const finite = (v: readonly number[]) => v.every(Number.isFinite)
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function shot(rand: () => number): Shot {
  const clean = (v: Vec3): Vec3 => [Number.isFinite(v[0]) ? v[0] : 0, Number.isFinite(v[1]) ? Math.max(0, v[1]) : 1, Number.isFinite(v[2]) ? v[2] : 0]
  return {
    from: clean(vec(rand)), bounce: clean(vec(rand, false)), to: clean(vec(rand)),
    apex: [num(rand, -1, 3), num(rand, -1, 3)], split: num(rand, -0.2, 1.2), hitter: pick(rand, ['a', 'b'] as const)
  }
}

function script(rand: () => number): Side[] {
  switch (int(rand, 0, 3)) {
    case 0: return []
    case 1: return [pick(rand, ['a', 'b'] as const)]
    case 2: return Array.from({ length: int(rand, 0, 200) }, (_, i) => (i % 8 < 4 ? (i % 2 ? 'a' : 'b') : (i % 2 ? 'b' : 'a')))
    default: { const bias = rand(); return Array.from({ length: int(rand, 0, 400) }, () => (rand() < bias ? 'a' : 'b')) }
  }
}

/** Height of a shot where it crosses the net plane (z = 0), or null if it does not cross before the bounce. */
function heightAtNet(s: Shot): { x: number; y: number } | null {
  if (Math.sign(s.from[2]) === Math.sign(s.bounce[2])) return null
  let lo = 0, hi = s.split
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (Math.sign(ballAt(s, mid)[2]) === Math.sign(s.from[2])) lo = mid; else hi = mid
  }
  const p = ballAt(s, (lo + hi) / 2)
  return { x: p[0], y: p[1] }
}

describe('ballAt: a shot through the air (property)', () => {
  it('never goes below the ground, stays finite, and passes through strike, bounce and end exactly', () => {
    const rand = mulberry32(SEED + 50)
    for (let i = 0; i < RUNS; i++) {
      const s = shot(rand)
      const t = num(rand)
      const p = ballAt(s, t)
      expect(finite(p)).toBe(true)
      expect(p[1]).toBeGreaterThanOrEqual(0)
      expect(dist(ballAt(s, 0), s.from)).toBeLessThan(1e-9)
      expect(dist(ballAt(s, 1), s.to)).toBeLessThan(1e-9)
      const split = Math.min(0.95, Math.max(0.05, Number.isFinite(s.split) ? s.split : 0.7))
      expect(dist(ballAt(s, split), s.bounce)).toBeLessThan(1e-9)
    }
  })

  it('is continuous: a small step in time is a small step in space (no teleport at the bounce)', () => {
    const rand = mulberry32(SEED + 51)
    for (let i = 0; i < RUNS; i++) {
      const s = shot(rand)
      const t = rand()
      const e = 1e-4
      // Bound: span of the shot plus arc height, divided by the shortest segment share
      const span = dist(s.from, s.bounce) + dist(s.bounce, s.to) + 8 * (Math.abs(Number.isFinite(s.apex[0]) ? s.apex[0] : 0) + Math.abs(Number.isFinite(s.apex[1]) ? s.apex[1] : 0)) + 6
      expect(dist(ballAt(s, t), ballAt(s, t + e))).toBeLessThanOrEqual((span / 0.05) * e * 1.01)
    }
  })
})

it('regression: a NaN arc height (seen from the generator) flies flat instead of returning NaN', () => {
  const s: Shot = { from: [1, 1, 11], bounce: [-2, 0, -8], to: [-3, 1, -13], apex: [Number.NaN, Number.POSITIVE_INFINITY], split: 0.7, hitter: 'a' }
  for (const t of [0, 0.3, 0.7, 0.9, 1]) expect(finite(ballAt(s, t))).toBe(true)
  expect(ballAt(s, 1)).toEqual([-3, 1, -13])
})

describe('planPoint / planMatch: rallies that are real tennis (property)', () => {
  const inSingles = (p: Vec3) => Math.abs(p[0]) <= TENNIS_COURT.singles / 2 && Math.abs(p[2]) <= TENNIS_COURT.half

  it('every shot clears the net, bounces in the singles court on the far side, and the rally chains', () => {
    const rand = mulberry32(SEED + 52)
    for (let i = 0; i < RUNS; i++) {
      const winner = pick(rand, ['a', 'b'] as const)
      const server = pick(rand, ['a', 'b'] as const)
      const plan = planPoint(winner, server, rand() < 0.5, int(rand, 0, 2 ** 31))
      expect(plan.shots.length).toBeGreaterThanOrEqual(1)
      expect(plan.shots[0]!.hitter).toBe(server)
      expect(plan.shots.at(-1)!.hitter).toBe(winner)
      plan.shots.forEach((s, k) => {
        const near = s.hitter === 'a'
        expect(Math.sign(s.from[2])).toBe(near ? 1 : -1)
        expect(Math.sign(s.bounce[2])).toBe(near ? -1 : 1)
        expect(inSingles(s.bounce)).toBe(true)
        const net = heightAtNet(s)
        expect(net).not.toBeNull()
        expect(net!.y).toBeGreaterThan(netHeight(net!.x))
        if (k > 0) {
          expect(s.hitter).not.toBe(plan.shots[k - 1]!.hitter)
          expect(s.from).toEqual(plan.shots[k - 1]!.to)
        }
      })
    }
  })

  it('the serve lands in the diagonal service box', () => {
    const rand = mulberry32(SEED + 53)
    for (let i = 0; i < RUNS; i++) {
      const plan = planPoint(pick(rand, ['a', 'b'] as const), pick(rand, ['a', 'b'] as const), rand() < 0.5, int(rand, 0, 2 ** 31))
      const serve = plan.shots[0]!
      expect(Math.abs(serve.bounce[2])).toBeLessThanOrEqual(TENNIS_COURT.service)
      expect(Math.sign(serve.bounce[0])).toBe(-Math.sign(serve.from[0]))
    }
  })

  it('the example match: one rally per point, won by the point\'s winner, serve alternating by game', () => {
    const plans = planMatch(EXAMPLE_MATCH)
    expect(plans).toHaveLength(EXAMPLE_MATCH.length)
    plans.forEach((p, k) => expect(p.shots.at(-1)!.hitter).toBe(EXAMPLE_MATCH[k]))
    expect(plans[0]!.server).toBe('a')
    expect(new Set(plans.map(p => p.server))).toEqual(new Set(['a', 'b']))
    expect(planMatch(EXAMPLE_MATCH)).toBe(plans) // cached: planned once per visit
  })
})

describe('rallyAt: the court and the board read the same clock (property)', () => {
  it('the court plays the point the board is about to hang, and the ball stays on or above the ground', () => {
    const rand = mulberry32(SEED + 54)
    const n = EXAMPLE_MATCH.length
    for (let i = 0; i < RUNS; i++) {
      const p = num(rand)
      const r = rallyAt(p)
      const board = stageAt(p)
      expect(r.point).toBe(Math.min(n - 1, board.played))
      expect(r.f).toBeGreaterThanOrEqual(0)
      expect(r.f).toBeLessThanOrEqual(1)
      if (board.played >= n) expect(r.f).toBe(1)
      expect(r.ball[1]).toBeGreaterThanOrEqual(0)
      expect(r.bounces.length).toBeLessThanOrEqual(r.shots.length)
    }
  })

  it('scrolling further never goes back a point or back in the rally', () => {
    const rand = mulberry32(SEED + 55)
    for (let i = 0; i < RUNS; i++) {
      const a = rand(), b = rand()
      const [lo, hi] = a < b ? [a, b] : [b, a]
      const x = rallyAt(lo), y = rallyAt(hi)
      expect(y.point > x.point || (y.point === x.point && y.f >= x.f - 1e-12)).toBe(true)
    }
  })

  it('any script, including empty and one point: finite, in range, never throws', () => {
    const rand = mulberry32(SEED + 56)
    for (let i = 0; i < 300; i++) {
      const sc = script(rand)
      const r = rallyAt(num(rand), sc)
      expect(finite(r.ball)).toBe(true)
      expect(r.point).toBeLessThan(Math.max(1, sc.length))
    }
  })

  it('the trail starts at the first strike and ends on the ball', () => {
    const rand = mulberry32(SEED + 57)
    for (let i = 0; i < RUNS; i++) {
      const r = rallyAt(rand())
      const tr = trailPoints(r, int(rand, 1, 30))
      expect(tr.length).toBeGreaterThanOrEqual(1)
      expect(dist(tr[0]!, r.shots[0]!.from)).toBeLessThan(1e-9)
      expect(dist(tr.at(-1)!, r.ball)).toBeLessThan(1e-6)
    }
  })

  it('starts on the first serve and ends with the last point complete', () => {
    expect(rallyAt(0).point).toBe(0)
    expect(rallyAt(0).f).toBe(0)
    const end = rallyAt(1)
    expect(end.point).toBe(EXAMPLE_MATCH.length - 1)
    expect(end.f).toBe(1)
    expect(stageAt(STAGE.play).match.winner).toBe('a')
  })
})

describe('cameraAt: a broadcast camera, not a fly-through (property)', () => {
  const corners: Vec3[] = [
    [-TENNIS_COURT.doubles / 2, 0, TENNIS_COURT.half], [TENNIS_COURT.doubles / 2, 0, TENNIS_COURT.half],
    [-TENNIS_COURT.doubles / 2, 0, -TENNIS_COURT.half], [TENNIS_COURT.doubles / 2, 0, -TENNIS_COURT.half],
    [-TENNIS_COURT.postX, TENNIS_COURT.netPost, 0], [TENNIS_COURT.postX, TENNIS_COURT.netPost, 0]
  ]
  const boxes: Vec3[] = [
    [-TENNIS_COURT.singles / 2, 0, TENNIS_COURT.service], [TENNIS_COURT.singles / 2, 0, TENNIS_COURT.service],
    [-TENNIS_COURT.singles / 2, 0, -TENNIS_COURT.service], [TENNIS_COURT.singles / 2, 0, -TENNIS_COURT.service]
  ]
  const onScreen = (pt: Vec3, cam: ReturnType<typeof cameraAt>, aspect: number) => {
    const [x, y, depth] = projectPoint(pt, cam, aspect)
    return depth > 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1
  }

  it('any input gives a finite camera above the stands, looking at the court, with a sane lens', () => {
    const rand = mulberry32(SEED + 58)
    for (let i = 0; i < RUNS; i++) {
      const cam = cameraAt(num(rand), num(rand, 0, 4), { yaw: num(rand, -2, 2), pitch: num(rand, -2, 2) }, num(rand, -20, 20))
      expect(finite([...cam.position, ...cam.target, cam.fov])).toBe(true)
      expect(cam.position[1]).toBeGreaterThan(4)
      expect(Math.abs(cam.target[0])).toBeLessThanOrEqual(1.5)
      expect(cam.fov).toBeGreaterThanOrEqual(34)
      expect(cam.fov).toBeLessThanOrEqual(58)
    }
  })

  it('at rest, the whole court and both net posts are in frame during play, at any phone or desktop aspect', () => {
    const rand = mulberry32(SEED + 59)
    for (let i = 0; i < RUNS; i++) {
      const aspect = 0.45 + rand() * 2.15
      const p = rand() * STAGE.play
      const cam = cameraAt(p, aspect, null, rallyAt(p).ball[0])
      for (const c of corners) expect(onScreen(c, cam, aspect)).toBe(true)
    }
  })

  it('whatever the drag, the service boxes stay in frame (the visitor can swing, never lose the court)', () => {
    const rand = mulberry32(SEED + 60)
    for (let i = 0; i < RUNS; i++) {
      const aspect = 0.45 + rand() * 2.15
      const cam = cameraAt(rand(), aspect, { yaw: num(rand, -1, 1), pitch: num(rand, -1, 1) })
      for (const c of boxes) expect(onScreen(c, cam, aspect)).toBe(true)
    }
  })

  it('moves continuously with scroll: no cuts', () => {
    const rand = mulberry32(SEED + 61)
    for (let i = 0; i < RUNS; i++) {
      const aspect = 0.45 + rand() * 2.15
      const p = rand()
      const e = 1e-4
      const a = cameraAt(p, aspect), b = cameraAt(p + e, aspect)
      expect(dist(a.position, b.position)).toBeLessThan(2500 * e)
    }
  })

  it('differential: projectPoint agrees with three.js PerspectiveCamera', () => {
    const rand = mulberry32(SEED + 62)
    for (let i = 0; i < 400; i++) {
      const aspect = 0.45 + rand() * 2.15
      const cam = cameraAt(rand(), aspect, { yaw: num(rand, -0.4, 0.4), pitch: num(rand, -0.1, 0.1) }, num(rand, -5, 5))
      const three = new PerspectiveCamera(cam.fov, aspect, 0.1, 1000)
      three.position.set(...cam.position)
      three.lookAt(...cam.target)
      three.updateMatrixWorld()
      const pt: Vec3 = [-15 + 30 * rand(), 4 * rand(), -20 + 40 * rand()]
      const ours = projectPoint(pt, cam, aspect)
      if (!(ours[2] > 0.5)) continue
      const v = new Vector3(...pt).project(three)
      expect(ours[0]).toBeCloseTo(v.x, 6)
      expect(ours[1]).toBeCloseTo(v.y, 6)
    }
  })

  it('drag swings are bounded by DRAG_LIMIT', () => {
    const base = cameraAt(0.3, 1.6)
    const far = cameraAt(0.3, 1.6, { yaw: 99, pitch: 99 })
    const lim = cameraAt(0.3, 1.6, { yaw: DRAG_LIMIT.yaw, pitch: DRAG_LIMIT.pitch })
    expect(far).toEqual(lim)
    expect(far).not.toEqual(base)
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
  const rankOf: Record<CourtTier, number> = { static: 0, lite: 1, full: 2 }

  it('reduced motion or no WebGL always keeps the static poster, whatever else is true', () => {
    const rand = mulberry32(SEED + 63)
    for (let i = 0; i < RUNS; i++) {
      const s = signals(rand)
      if (s.reducedMotion || !s.webgl) expect(courtTier(s)).toBe('static')
    }
  })

  it('more memory or more cores never lowers the tier', () => {
    const rand = mulberry32(SEED + 64)
    for (let i = 0; i < RUNS; i++) {
      const s = signals(rand)
      const more = { ...s, deviceMemory: s.deviceMemory === undefined ? undefined : s.deviceMemory * 2, cores: s.cores === undefined ? undefined : s.cores + int(rand, 1, 8) }
      expect(rankOf[courtTier(more)]).toBeGreaterThanOrEqual(rankOf[courtTier(s)])
    }
  })

  it('without an override: a software renderer, Data Saver, 2G, <4 GB or <4 cores stays static', () => {
    const rand = mulberry32(SEED + 65)
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

describe('sheenAt: the enamel under the pointer (property)', () => {
  it('stays on the card, tips at most maxTilt, and rests flat for invalid input', () => {
    const rand = mulberry32(SEED + 66)
    for (let i = 0; i < RUNS; i++) {
      const rect = { left: num(rand, -500, 500), top: num(rand, -500, 500), width: num(rand, -10, 800), height: num(rand, -10, 600) }
      const max = Math.abs(num(rand, 0, 10)) || 0
      const s = sheenAt(num(rand, -1000, 1500), num(rand, -1000, 1500), rect, max)
      expect(finite([s.x, s.y, s.rx, s.ry])).toBe(true)
      expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(100)
      expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(100)
      const cap = Number.isFinite(max) ? max : 0
      expect(Math.abs(s.rx)).toBeLessThanOrEqual(cap + 1e-9)
      expect(Math.abs(s.ry)).toBeLessThanOrEqual(cap + 1e-9)
    }
  })

  it('the centre of the card is flat, and tilt follows the pointer (right edge tips right)', () => {
    const r = { left: 10, top: 20, width: 300, height: 200 }
    expect(sheenAt(160, 120, r)).toEqual({ x: 50, y: 50, rx: 0, ry: 0 })
    expect(sheenAt(310, 120, r).ry).toBeGreaterThan(0)
    expect(sheenAt(160, 20, r).rx).toBeGreaterThan(0)
    const tilt = sheenFromTilt(Number.NaN, Number.NaN)
    expect(tilt).toEqual({ x: 50, y: 50, rx: 0, ry: 0 })
  })
})
