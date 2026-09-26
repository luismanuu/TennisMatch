/**
 * The court drawn as flat SVG shapes through the same camera and light as the 3D
 * court (DESIGN.md "The court · Poster"). It is what every device paints first, from
 * the server HTML, and the whole hero on devices that keep the static court.
 */
import { TENNIS_COURT as C, cameraAt, courtLines, lightAt, netHeight, projectPoint, type Vec3 } from './courtShot'

export interface Poster {
  w: number
  h: number
  horizon: number
  sky: [string, string, string]
  ground: string
  apron: string
  apronFill: string
  court: string
  courtFill: string
  lines: string[]
  lineFill: string
  net: string
  band: string
  posts: Array<[number, number, number, number]>
  poles: Array<[number, number, number, number]>
  lamps: Array<[number, number, number]>
  lampFill: string
  flood: number
  pools: Array<[number, number, number, number]>
}

const APRON_W = C.doubles + 2 * C.runSide
const APRON_L = 2 * (C.half + C.runBack)
export const TOWER = { x: APRON_W / 2 + 13, z: APRON_L / 2 + 10, h: 24 } as const

const r1 = (x: number) => Math.round(x * 10) / 10
const hex = (c: string) => [1, 3, 5].map(i => Number.parseInt(c.slice(i, i + 2), 16))
/** Mix two #rrggbb colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b)
  const k = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * k).toString(16).padStart(2, '0')).join('')
}

/** The palette of the court under a given light (shared with the 3D scene). */
export function courtColours(flood: number, dusk: number) {
  return {
    ground: mix('#0a1511', '#07100c', flood),
    court: mix('#1f4c3d', '#1f5c47', flood),
    apron: mix('#15342a', '#134233', flood),
    line: mix('#b7c1bb', '#eef0ea', flood),
    lamp: mix('#2c332f', '#fff4de', flood),
    skyTop: '#050c09',
    skyMid: mix('#0b1c16', '#081611', flood),
    skyLow: mix('#081611', '#3a3122', dusk)
  }
}

/** Draw the court at `progress` into a w × h frame. */
export function drawPoster(w: number, h: number, progress: number): Poster {
  const aspect = w / h
  const cam = cameraAt(progress, aspect)
  const { flood, dusk } = lightAt(progress)
  const col = courtColours(flood, dusk)
  const px = (v: Vec3): [number, number] | null => {
    const [x, y, d] = projectPoint(v, cam, aspect)
    if (!(d > 0.5)) return null
    return [r1(((x + 1) / 2) * w), r1(((1 - y) / 2) * h)]
  }
  const poly = (pts: Vec3[]) => {
    const out = pts.map(px)
    return out.every(Boolean) ? out.map(p => p!.join(',')).join(' ') : ''
  }
  const quad = (x1: number, z1: number, x2: number, z2: number) => poly([[x1, 0, z1], [x2, 0, z1], [x2, 0, z2], [x1, 0, z2]])

  const far = px([0, 0, -500]) ?? px([500, 0, 0]) ?? px([-500, 0, 0])
  const horizon = far ? Math.max(0, far[1]) : 0

  const lines = courtLines().map(([x1, z1, x2, z2, lw]) =>
    Math.abs(x2 - x1) > Math.abs(z2 - z1)
      ? quad(Math.min(x1, x2) - lw / 2, z1 - lw / 2, Math.max(x1, x2) + lw / 2, z1 + lw / 2)
      : quad(x1 - lw / 2, Math.min(z1, z2) - lw / 2, x1 + lw / 2, Math.max(z1, z2) + lw / 2)
  ).filter(Boolean)

  const netTop: Vec3[] = Array.from({ length: 13 }, (_, i) => {
    const x = -C.postX + (i / 12) * 2 * C.postX
    return [x, netHeight(x), 0]
  })
  const net = poly([[-C.postX, 0, 0], ...netTop, [C.postX, 0, 0]])
  const band = netTop.map(px).every(Boolean) ? netTop.map(v => px(v)!.join(',')).join(' ') : ''
  const posts = ([-1, 1] as const).flatMap(s => {
    const a = px([s * C.postX, 0, 0]), b = px([s * C.postX, C.netPost, 0])
    return a && b ? [[a[0], a[1], b[0], b[1]] as [number, number, number, number]] : []
  })
  const towers = [[-TOWER.x, -TOWER.z], [TOWER.x, -TOWER.z], [-TOWER.x, TOWER.z], [TOWER.x, TOWER.z]] as const
  const poles = towers.flatMap(([x, z]) => {
    const a = px([x, 0, z]), b = px([x, TOWER.h, z])
    return a && b ? [[a[0], a[1], b[0], b[1]] as [number, number, number, number]] : []
  })
  const lamps = towers.flatMap(([x, z]) => {
    const p = px([x, TOWER.h, z])
    if (!p) return []
    const [, , d] = projectPoint([x, TOWER.h, z], cam, aspect)
    return [[p[0], p[1], r1(Math.max(1.5, (1.3 * h) / d))] as [number, number, number]]
  })
  // Pools of floodlight on the court, one per tower, drawn as ellipses under the lines
  const pools = ([[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]] as const).flatMap(([fx, fz]) => {
    const c = px([fx * C.doubles, 0, fz * C.half * 1.4])
    const e = px([fx * C.doubles + 6, 0, fz * C.half * 1.4])
    const n = px([fx * C.doubles, 0, fz * C.half * 1.4 + 7])
    if (!c || !e || !n) return []
    return [[c[0], c[1], r1(Math.hypot(e[0] - c[0], e[1] - c[1]) + 1), r1(Math.hypot(n[0] - c[0], n[1] - c[1]) + 1)] as [number, number, number, number]]
  })

  return {
    w, h, horizon,
    sky: [col.skyTop, col.skyMid, col.skyLow],
    ground: col.ground,
    apron: quad(-APRON_W / 2, -APRON_L / 2, APRON_W / 2, APRON_L / 2), apronFill: col.apron,
    court: quad(-C.doubles / 2, -C.half, C.doubles / 2, C.half), courtFill: col.court,
    lines, lineFill: col.line, net, band, posts, poles, lamps, lampFill: col.lamp, flood, pools
  }
}
