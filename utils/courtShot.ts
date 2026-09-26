/**
 * The landing's court, shot like a product (DESIGN.md "The court"). Pure, DOM-free and
 * three.js-free: the WebGL scene (lib/court/courtScene.ts) and the SVG poster
 * (utils/courtPoster.ts) both read the camera and the light from here, so the first
 * paint and the 3D court always frame the same shot.
 *
 * Units are metres. x runs across the court, z along it (net at z = 0), y is up.
 */
import { clamp01 } from './tablero'

export type Vec3 = [number, number, number]

export const TENNIS_COURT = {
  half: 11.885,
  doubles: 10.97,
  singles: 8.23,
  service: 6.4,
  netCenter: 0.914,
  netPost: 1.07,
  postX: 6.4,
  runBack: 6.4,
  runSide: 3.66
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const fin = (x: number, fallback = 0) => (Number.isFinite(x) ? x : fallback)
/** Symmetric ease for camera moves: slow out, slow in, never a jolt (C1 continuous). */
export const easeInOut = (t: number) => { const x = clamp01(t); return x * x * x * (x * (6 * x - 15) + 10) }

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

/**
 * `shift` moves the picture in the frame without turning the camera (a lens shift, in
 * normalised device units), so the court can sit clear of the copy: right of it on a
 * wide frame, above it on a phone.
 */
export interface CameraPose { position: Vec3; target: Vec3; fov: number; shift: [number, number] }

interface Key { p: number; yaw: number; elev: number; dist: number; ty: number; tz: number; sx: number }
/**
 * Four held shots and the slow moves between them, as a product film would cut
 * them without cutting: a low three-quarter at dusk, a profile along the net, the
 * court from above like a plan, and a high end-on view under full floodlights.
 */
export const SHOTS: readonly Key[] = [
  { p: 0, yaw: -0.5, elev: 0.22, dist: 44, ty: 0, tz: 0.8, sx: 0.32 },
  { p: 0.12, yaw: -0.5, elev: 0.22, dist: 44, ty: 0, tz: 0.8, sx: 0.32 },
  { p: 0.38, yaw: -1.35, elev: 0.3, dist: 37, ty: 0.3, tz: 0, sx: 0.16 },
  { p: 0.66, yaw: -1.57, elev: 1.18, dist: 38, ty: 0, tz: 0, sx: 0.2 },
  { p: 0.78, yaw: -0.78, elev: 0.92, dist: 46, ty: 0, tz: -0.3, sx: 0.22 },
  { p: 0.9, yaw: -0.08, elev: 0.62, dist: 44, ty: 0, tz: -0.6, sx: 0.26 },
  { p: 1, yaw: -0.08, elev: 0.62, dist: 44, ty: 0, tz: -0.6, sx: 0.26 }
]

/**
 * The camera for a scroll progress and a frame aspect (width / height). Narrow frames
 * widen the lens and pull back, so a phone keeps the whole court in shot.
 */
export function cameraAt(progress: number, aspect: number): CameraPose {
  const p = clamp01(progress)
  const a = Math.min(3, Math.max(0.3, fin(aspect, 1.6)))
  let i = 0
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1]!.p) i++
  const k0 = SHOTS[i]!
  const k1 = SHOTS[i + 1]!
  const t = easeInOut((p - k0.p) / (k1.p - k0.p))

  const narrow = Math.max(0, 1.5 - a)
  const fov = Math.min(60, 32 + narrow * 18)
  const dist = lerp(k0.dist, k1.dist, t) * (1 + narrow * 0.85)
  const yaw = lerp(k0.yaw, k1.yaw, t)
  const elev = Math.min(1.3, lerp(k0.elev, k1.elev, t) + narrow * 0.1)
  const target: Vec3 = [0, lerp(k0.ty, k1.ty, t), lerp(k0.tz, k1.tz, t)]
  const position: Vec3 = [
    target[0] + dist * Math.sin(yaw) * Math.cos(elev),
    target[1] + dist * Math.sin(elev),
    target[2] + dist * Math.cos(yaw) * Math.cos(elev)
  ]
  // Wide frames push the court right of the copy; phones lift it above the copy
  const wide = Math.min(1, Math.max(0, (a - 1.1) / 0.5))
  const shift: [number, number] = [lerp(k0.sx, k1.sx, t) * wide, 0.22 * Math.min(1, narrow / 0.6)]
  return { position, target, fov, shift }
}

/**
 * Pinhole projection matching three.js' PerspectiveCamera + lookAt (up = +y):
 * normalised device x, y (in [-1, 1] when on screen) and the depth in front of the camera.
 */
export function projectPoint(point: Vec3, cam: CameraPose, aspect: number): [number, number, number] {
  const [px, py, pz] = cam.position
  let fx = cam.target[0] - px, fy = cam.target[1] - py, fz = cam.target[2] - pz
  const fl = Math.hypot(fx, fy, fz) || 1
  fx /= fl; fy /= fl; fz /= fl
  let rx = -fz, rz = fx
  const rl = Math.hypot(rx, rz) || 1
  rx /= rl; rz /= rl
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy
  const vx = point[0] - px, vy = point[1] - py, vz = point[2] - pz
  const cx = vx * rx + vz * rz
  const cy = vx * ux + vy * uy + vz * uz
  const depth = vx * fx + vy * fy + vz * fz
  const f = Math.tan((cam.fov * Math.PI) / 360)
  return [cx / (depth * f * fin(aspect, 1)) + cam.shift[0], cy / (depth * f) + cam.shift[1], depth]
}

// ── Light ──────────────────────────────────────────────────────────────────

export interface Light {
  /** 0 dusk only … 1 floodlights fully on. */
  flood: number
  /** How much of the last daylight is left in the sky, 1 … 0. */
  dusk: number
  /** Tone-mapping exposure. */
  exposure: number
}

/** Floodlights come up between these scroll positions, the way a stadium powers on. */
export const FLOOD = { start: 0.2, full: 0.55 } as const

/** Scroll progress → light. Monotonic: scrolling on never dims the court. */
export function lightAt(progress: number): Light {
  const p = clamp01(progress)
  const flood = easeInOut((p - FLOOD.start) / (FLOOD.full - FLOOD.start))
  const dusk = 1 - easeInOut(p / 0.8)
  return { flood, dusk, exposure: 0.82 + 0.3 * flood }
}

// ── Copy chapters ──────────────────────────────────────────────────────────

/** Each chapter holds fully between `from` and `to`; it crosses with its neighbours over `FADE`. */
export const CHAPTERS: ReadonlyArray<{ from: number; to: number }> = [
  { from: 0, to: 0.13 },
  { from: 0.27, to: 0.4 },
  { from: 0.54, to: 0.67 },
  { from: 0.81, to: 1 }
]
export const FADE = 0.07

/**
 * How visible each chapter of the hero copy is at a scroll progress, 0..1. The first
 * chapter is fully shown at rest and the last at the end; between holds the outgoing
 * chapter finishes leaving before the next one arrives, so two lines of large type
 * never sit on top of each other.
 */
export function chaptersAt(progress: number, chapters = CHAPTERS, fade = FADE): number[] {
  const p = clamp01(progress)
  const f = Math.max(1e-6, fade)
  return chapters.map((c, i) => {
    const first = i === 0
    const last = i === chapters.length - 1
    const inn = first ? 1 : clamp01((p - (c.from - f)) / f)
    const out = last ? 1 : clamp01(((c.to + f) - p) / f)
    return easeInOut(Math.min(inn, out))
  })
}

// ── Numbers ────────────────────────────────────────────────────────────────

/**
 * A number counting up to its value when it arrives (Inicio's SR). Whole numbers only,
 * never past the target, exactly the target at the end, and it never runs backwards.
 */
export function countUp(from: number, to: number, t: number): number {
  const a = Math.round(fin(from))
  const b = Math.round(fin(to))
  const x = clamp01(t)
  if (x >= 1) return b
  const eased = 1 - Math.pow(1 - x, 4)
  return Math.round(a + (b - a) * eased)
}

// ── Devices ────────────────────────────────────────────────────────────────

export type CourtTier = 'full' | 'lite' | 'static'
export interface DeviceSignals {
  webgl: boolean
  software?: boolean
  reducedMotion: boolean
  saveData?: boolean
  deviceMemory?: number
  cores?: number
  effectiveType?: string
  override?: CourtTier | null
}

/**
 * Which court a device gets. Anything that would make the 3D court a cost rather than a
 * pleasure keeps the static poster: no WebGL, a software renderer, reduced motion, Data
 * Saver, a 2G link, under 4 GB or under 4 cores. Unknown signals count as capable.
 */
export function courtTier(s: DeviceSignals): CourtTier {
  if (s.reducedMotion || s.override === 'static' || !s.webgl) return 'static'
  if (s.override === 'full' || s.override === 'lite') return s.override
  if (s.software || s.saveData) return 'static'
  if (s.effectiveType === 'slow-2g' || s.effectiveType === '2g') return 'static'
  const mem = s.deviceMemory
  const cores = s.cores
  if ((mem !== undefined && mem < 4) || (cores !== undefined && cores < 4)) return 'static'
  if ((mem !== undefined && mem < 8) || (cores !== undefined && cores < 8)) return 'lite'
  return 'full'
}
