/**
 * Broadcast layer on the Tablero world (DESIGN.md "Broadcast"): pure, DOM-free and
 * three.js-free geometry for the landing's court. The WebGL scene
 * (lib/broadcast/courtScene.ts) and the static SVG poster both read from here, so
 * the camera, the shot paths and the scoreboard can never disagree.
 *
 * Units are metres. x runs across the court, z along it (net at z = 0, the near
 * baseline at z = +TENNIS_COURT.half), y is up. Player A plays the near end, B the far end.
 */
import { EXAMPLE_MATCH, STAGE, clamp01, linger, scoreAfter, stepAt, type Side } from './tablero'

export type Vec3 = [number, number, number]

export const TENNIS_COURT = {
  half: 11.885,
  doubles: 10.97,
  singles: 8.23,
  service: 6.4,
  netCenter: 0.914,
  netPost: 1.07,
  postX: 6.4,
  /** Run-off: behind each baseline and beside each doubles line. */
  runBack: 6.4,
  runSide: 3.66
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const fin = (x: number, fallback = 0) => (Number.isFinite(x) ? x : fallback)

/** Chalk lines as [x1, z1, x2, z2, width] segments on the ground. */
export function courtLines(): Array<[number, number, number, number, number]> {
  const { half, doubles, singles, service } = TENNIS_COURT
  const d = doubles / 2
  const s = singles / 2
  return [
    [-d, half, d, half, 0.1], [-d, -half, d, -half, 0.1],
    [-d, -half, -d, half, 0.05], [d, -half, d, half, 0.05],
    [-s, -half, -s, half, 0.05], [s, -half, s, half, 0.05],
    [-s, service, s, service, 0.05], [-s, -service, s, -service, 0.05],
    [0, -service, 0, service, 0.05],
    [0, half, 0, half - 0.1, 0.05], [0, -half, 0, -half + 0.1, 0.05]
  ]
}

/** Height of the top of the net at x: 0.914 m in the middle, 1.07 m at the posts. */
export function netHeight(x: number): number {
  const r = Math.min(1, Math.abs(fin(x)) / TENNIS_COURT.postX)
  return TENNIS_COURT.netCenter + (TENNIS_COURT.netPost - TENNIS_COURT.netCenter) * r * r
}

// ── Camera ─────────────────────────────────────────────────────────────────

export interface CameraPose { position: Vec3; target: Vec3; fov: number }
export interface DragOffset { yaw: number; pitch: number }

/** How far the visitor can swing the broadcast camera by dragging (radians). */
export const DRAG_LIMIT = { yaw: 0.42, pitch: 0.1 } as const

interface Shot3 { p: number; yaw: number; elev: number; dist: number; tx: number; ty: number; tz: number }
/**
 * Camera keys along the landing's scroll, in broadcast grammar: an establishing
 * wide from the corner, the high end-on match camera for play, a push toward the
 * net for the result, a slow crane up for the ladder. Never a fly-through.
 */
const KEYS: readonly Shot3[] = [
  { p: 0, yaw: -0.27, elev: 0.54, dist: 34, tx: 0, ty: 0, tz: 0.6 },
  { p: 0.1, yaw: -0.02, elev: 0.4, dist: 31, tx: 0, ty: 0, tz: -0.4 },
  { p: STAGE.play - 0.02, yaw: 0.05, elev: 0.38, dist: 29.5, tx: 0, ty: 0, tz: -1 },
  { p: STAGE.confirm, yaw: 0.2, elev: 0.33, dist: 25, tx: 0, ty: 0.4, tz: -0.5 },
  { p: 1, yaw: 0.28, elev: 0.5, dist: 28, tx: 0, ty: 0.4, tz: -0.5 }
]

export const clampDrag = (d?: Partial<DragOffset> | null): DragOffset => ({
  yaw: Math.max(-DRAG_LIMIT.yaw, Math.min(DRAG_LIMIT.yaw, fin(d?.yaw ?? 0))),
  pitch: Math.max(-DRAG_LIMIT.pitch, Math.min(DRAG_LIMIT.pitch, fin(d?.pitch ?? 0)))
})

/**
 * The broadcast camera for a scroll progress and a frame aspect (width / height).
 * Narrow frames pull back and widen the lens so the whole court still fits on a
 * phone. `followX` lets the camera lean a little toward the ball, as an operator does.
 */
export function cameraAt(progress: number, aspect: number, drag?: Partial<DragOffset> | null, followX = 0): CameraPose {
  const p = clamp01(progress)
  const a = Math.min(3, Math.max(0.3, fin(aspect, 1.6)))
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1]!.p) i++
  const k0 = KEYS[i]!
  const k1 = KEYS[i + 1]!
  const t = smooth(clamp01((p - k0.p) / (k1.p - k0.p)))
  const d = clampDrag(drag)

  // Portrait framing: a wider lens and a longer throw keep both doubles lines in frame
  const narrow = Math.max(0, 1.5 - a)
  const fov = Math.min(58, 34 + narrow * 16)
  const throwScale = 1 + narrow * 0.42

  // A phone frame is narrow: the same drag swings less, so the court never leaves it
  const yaw = lerp(k0.yaw, k1.yaw, t) + d.yaw * Math.min(1, 0.35 + a * 0.45)
  const elev = Math.min(1.25, Math.max(0.12, lerp(k0.elev, k1.elev, t) + d.pitch + narrow * 0.12))
  const dist = lerp(k0.dist, k1.dist, t) * throwScale
  const target: Vec3 = [
    lerp(k0.tx, k1.tx, t) + Math.max(-1.5, Math.min(1.5, fin(followX) * 0.12)),
    lerp(k0.ty, k1.ty, t),
    lerp(k0.tz, k1.tz, t)
  ]
  const position: Vec3 = [
    target[0] + dist * Math.sin(yaw) * Math.cos(elev),
    target[1] + dist * Math.sin(elev),
    target[2] + dist * Math.cos(yaw) * Math.cos(elev)
  ]
  return { position, target, fov }
}

/**
 * Pinhole projection matching three.js' PerspectiveCamera + lookAt (up = +y):
 * returns normalised device x, y in [-1, 1] when on screen, and the depth in
 * front of the camera (negative means behind it).
 */
export function projectPoint(point: Vec3, cam: CameraPose, aspect: number): [number, number, number] {
  const [px, py, pz] = cam.position
  let fx = cam.target[0] - px, fy = cam.target[1] - py, fz = cam.target[2] - pz
  const fl = Math.hypot(fx, fy, fz) || 1
  fx /= fl; fy /= fl; fz /= fl
  // right = forward × up
  let rx = -fz, rz = fx
  const rl = Math.hypot(rx, rz) || 1
  rx /= rl; rz /= rl
  // up' = right × forward
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy
  const vx = point[0] - px, vy = point[1] - py, vz = point[2] - pz
  const cx = vx * rx + vz * rz
  const cy = vx * ux + vy * uy + vz * uz
  const depth = vx * fx + vy * fy + vz * fz
  const f = Math.tan((cam.fov * Math.PI) / 360)
  const a = fin(aspect, 1)
  return [cx / (depth * f * a), cy / (depth * f), depth]
}

// ── Shots ──────────────────────────────────────────────────────────────────

/** One shot: struck at `from`, lands at `bounce`, carries on to `to`. */
export interface Shot {
  from: Vec3
  bounce: Vec3
  to: Vec3
  /** Extra height of each arc over the straight line, at its middle. */
  apex: [number, number]
  /** Share of the shot's time spent before the bounce. */
  split: number
  hitter: Side
}

/** Position of the ball `t` (0..1) of the way through a shot. Never below the ground. */
export function ballAt(shot: Shot, t: number): Vec3 {
  const u = clamp01(t)
  const split = Math.min(0.95, Math.max(0.05, fin(shot.split, 0.7)))
  const [a, b, h] = u <= split ? [shot.from, shot.bounce, shot.apex[0]] : [shot.bounce, shot.to, shot.apex[1]]
  const s = u <= split ? u / split : (u - split) / (1 - split)
  const y = lerp(a[1], b[1], s) + 4 * Math.max(0, fin(h)) * s * (1 - s)
  return [lerp(a[0], b[0], s), Math.max(0, y), lerp(a[2], b[2], s)]
}

/** Seeded generator so the example match plays the same rallies on every visit. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo)

const NET_MARGIN = 0.22

/** Least arc height so a shot from `from` to `bounce` clears the net with a margin. */
function clearance(from: Vec3, bounce: Vec3): number {
  const dz = from[2] - bounce[2]
  if (Math.sign(from[2]) === Math.sign(bounce[2]) || dz === 0) return 0
  const s = from[2] / dz
  const x = lerp(from[0], bounce[0], s)
  const line = lerp(from[1], 0, s)
  const need = netHeight(x) + NET_MARGIN - line
  return need > 0 ? need / (4 * s * (1 - s)) : 0
}

const end = (s: Side) => (s === 'a' ? 1 : -1)
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a')

export interface PointPlan { winner: Side; server: Side; shots: Shot[] }

/**
 * The rally for one point: a serve from the right side of the court, then
 * groundstrokes to deep, in-court bounces; the point's winner strikes the last
 * shot, which bounces in and carries on past the other player. Every shot clears the net.
 */
export function planPoint(winner: Side, server: Side, deuceSide: boolean, seed: number): PointPlan {
  const r = rng(seed)
  const receiver = other(server)
  // Winner hits last: odd rally lengths end on the server's racket, even on the receiver's
  const lengths = winner === server ? [1, 3, 3, 5] : [2, 2, 4, 4]
  const n = lengths[Math.floor(r() * lengths.length)]!
  const sw = TENNIS_COURT.singles / 2 - 0.35
  const shots: Shot[] = []

  const sv = end(server)
  const serveX = (deuceSide ? 1 : -1) * sv * between(r, 0.4, 1.1)
  let from: Vec3 = [serveX, 2.75, sv * (TENNIS_COURT.half + 0.15)]
  let hitter = server

  for (let k = 0; k < n; k++) {
    const e = end(hitter)
    const last = k === n - 1
    const bounce: Vec3 = k === 0
      ? [-Math.sign(serveX || 1) * between(r, 0.5, sw - 0.2), 0, -e * between(r, 3.8, TENNIS_COURT.service - 0.35)]
      : [between(r, -sw, sw), 0, -e * between(r, 6.8, TENNIS_COURT.half - 0.45)]
    const to: Vec3 = last
      // A winner: past the other player, into the back run-off
      ? [bounce[0] * 1.35, 0.55, -e * (TENNIS_COURT.half + between(r, 3.2, 5.2))]
      : [between(r, -3.2, 3.2), between(r, 0.85, 1.15), -e * (TENNIS_COURT.half + between(r, 0.4, 1.4))]
    const dA = Math.hypot(bounce[0] - from[0], bounce[2] - from[2])
    const dB = Math.hypot(to[0] - bounce[0], to[2] - bounce[2])
    const apexA = Math.max(k === 0 ? 0.12 : between(r, 0.9, 1.9), clearance(from, bounce))
    shots.push({
      from, bounce, to,
      apex: [apexA, last ? between(r, 0.5, 0.9) : between(r, 0.8, 1.3)],
      split: Math.min(0.85, Math.max(0.5, dA / (dA + dB * 0.8))),
      hitter
    })
    from = to
    hitter = other(hitter)
  }
  return { winner, server, shots }
}

const planCache = new WeakMap<readonly Side[], PointPlan[]>()

/**
 * A rally for every point of a match. Service alternates by game (A serves first),
 * and the serve comes from the deuce side on even points of each game.
 */
export function planMatch(script: readonly Side[] = EXAMPLE_MATCH): PointPlan[] {
  const hit = planCache.get(script)
  if (hit) return hit
  const plans: PointPlan[] = []
  let gamesBefore = 0
  let inGame = 0
  for (let k = 0; k < script.length; k++) {
    const server: Side = gamesBefore % 2 === 0 ? 'a' : 'b'
    plans.push(planPoint(script[k]!, server, inGame % 2 === 0, 9173 + k * 131))
    const s = scoreAfter(script.slice(0, k + 1))
    const games = s.sets.reduce((n, x) => n + x[0] + x[1], 0) + s.games[0] + s.games[1]
    if (games !== gamesBefore) { gamesBefore = games; inGame = 0 } else inGame++
  }
  planCache.set(script, plans)
  return plans
}

export interface RallyState {
  /** Index of the point on court (the last one once the match is over). */
  point: number
  /** 0..1 through that point. */
  f: number
  shots: Shot[]
  ball: Vec3
  /** Bounces already made in this point. */
  bounces: Vec3[]
}

/**
 * What the court shows at a scroll progress. It walks the same clock as
 * `stageAt`, so the board hangs a new point exactly when the ball finishes one.
 */
export function rallyAt(progress: number, script: readonly Side[] = EXAMPLE_MATCH): RallyState {
  const plans = planMatch(script)
  const n = script.length
  if (n === 0) return { point: 0, f: 0, shots: [], ball: [0, 1, 0], bounces: [] }
  const playT = linger(clamp01(progress) / STAGE.play, 0.35)
  const played = stepAt(playT, n)
  const point = Math.min(n - 1, played)
  const f = played >= n ? 1 : clamp01(playT * n - played)
  const shots = plans[point]!.shots
  const m = shots.length
  const idx = Math.min(m - 1, Math.floor(f * m))
  const t = f * m - idx
  const bounces: Vec3[] = []
  for (let k = 0; k <= idx; k++) {
    const sh = shots[k]!
    if (k < idx || t >= sh.split) bounces.push(sh.bounce)
  }
  return { point, f, shots, ball: ballAt(shots[idx]!, t), bounces }
}

/** Trail from the first strike of the point to the ball, `perShot` samples per shot. */
export function trailPoints(state: RallyState, perShot = 20): Vec3[] {
  const m = state.shots.length
  const out: Vec3[] = []
  const reach = state.f * m
  for (let k = 0; k < m; k++) {
    if (reach < k) break
    const upto = Math.min(1, reach - k)
    const steps = Math.max(1, Math.ceil(perShot * upto))
    for (let i = k === 0 ? 0 : 1; i <= steps; i++) out.push(ballAt(state.shots[k]!, (i / steps) * upto))
  }
  return out
}

// ── Devices ────────────────────────────────────────────────────────────────

export type CourtTier = 'full' | 'lite' | 'static'
export interface DeviceSignals {
  webgl: boolean
  /** The WebGL renderer is a software rasteriser (SwiftShader, llvmpipe…). */
  software?: boolean
  reducedMotion: boolean
  saveData?: boolean
  /** navigator.deviceMemory, GB (Chromium only). */
  deviceMemory?: number
  cores?: number
  effectiveType?: string
  /** QA override from the URL (?court=full|lite|static). Reduced motion still wins. */
  override?: CourtTier | null
}

/**
 * Which court a device gets. Anything that would make the 3D court a cost rather
 * than a pleasure keeps the static Tablero poster: no WebGL, a software renderer,
 * reduced motion, Data Saver, a 2G link, under 4 GB or under 4 cores. Unknown
 * signals (Safari and Firefox hide memory) count as capable. More memory or cores
 * never lowers the tier.
 */
export function courtTier(s: DeviceSignals): CourtTier {
  if (s.reducedMotion) return 'static'
  if (s.override === 'static') return 'static'
  if (!s.webgl) return 'static'
  if (s.override === 'full' || s.override === 'lite') return s.override
  if (s.software || s.saveData) return 'static'
  if (s.effectiveType === 'slow-2g' || s.effectiveType === '2g') return 'static'
  const mem = s.deviceMemory
  const cores = s.cores
  if ((mem !== undefined && mem < 4) || (cores !== undefined && cores < 4)) return 'static'
  if ((mem !== undefined && mem < 8) || (cores !== undefined && cores < 8)) return 'lite'
  return 'full'
}

// ── Enamel sheen (player card) ─────────────────────────────────────────────

export interface Sheen { x: number; y: number; rx: number; ry: number }

/**
 * Pointer over a card → where the light sits on the enamel (percent) and how far
 * the card tips toward the pointer (degrees, at most `maxTilt`). Off-card or
 * invalid input rests the card flat with the light in the middle.
 */
export function sheenAt(px: number, py: number, rect: { left: number; top: number; width: number; height: number }, maxTilt = 4): Sheen {
  const w = rect.width, h = rect.height
  if (!(w > 0) || !(h > 0) || !Number.isFinite(px) || !Number.isFinite(py)) return { x: 50, y: 50, rx: 0, ry: 0 }
  const u = clamp01((px - rect.left) / w)
  const v = clamp01((py - rect.top) / h)
  const m = Math.max(0, fin(maxTilt))
  return { x: u * 100, y: v * 100, rx: (0.5 - v) * 2 * m, ry: (u - 0.5) * 2 * m }
}

/** Device tilt (deviceorientation beta/gamma, degrees) → the same sheen, as if the pointer moved. */
export function sheenFromTilt(beta: number, gamma: number, maxTilt = 4): Sheen {
  const u = clamp01(0.5 + fin(gamma) / 60)
  const v = clamp01(0.5 + (fin(beta, 45) - 45) / 60)
  return sheenAt(u, v, { left: 0, top: 0, width: 1, height: 1 }, maxTilt)
}
