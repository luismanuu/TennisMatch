/**
 * The court drawn as flat SVG shapes through the broadcast camera (DESIGN.md
 * "Broadcast · Poster"). It is the hero every device sees first, in the server
 * HTML, and the whole hero on devices that keep the static court. Because it uses
 * the same cameraAt/projectPoint as the WebGL scene, the 3D court fades in over
 * a drawing with the same framing.
 */
import { TENNIS_COURT as C, cameraAt, courtLines, netHeight, projectPoint, rallyAt, trailPoints, type Vec3 } from './broadcast'

export interface Poster {
  w: number
  h: number
  horizon: number
  stands: string[]
  apron: string
  court: string
  lines: string[]
  net: string
  band: string
  posts: Array<[number, number, number, number]>
  lamps: Array<[number, number, number]>
  trail: string
  ball: [number, number, number] | null
  shadow: [number, number, number] | null
}

const APRON_W = C.doubles + 2 * C.runSide
const APRON_L = 2 * (C.half + C.runBack)
const ROWS = 9, RISE = 0.48, DEPTH = 0.85

const r1 = (x: number) => Math.round(x * 10) / 10

/** Draw the court at `progress` into a w × h frame. `withBall` adds the rally (static tier). */
export function drawPoster(w: number, h: number, progress: number, withBall: boolean): Poster {
  const aspect = w / h
  const rally = rallyAt(progress)
  const cam = cameraAt(progress, aspect, null, rally.ball[0])
  const px = (v: Vec3): [number, number] | null => {
    const [x, y, d] = projectPoint(v, cam, aspect)
    if (!(d > 0.5)) return null
    return [r1(((x + 1) / 2) * w), r1(((1 - y) / 2) * h)]
  }
  const poly = (pts: Vec3[]) => {
    const out = pts.map(px)
    return out.every(Boolean) ? out.map(p => p!.join(',')).join(' ') : ''
  }
  const quad = (x1: number, z1: number, x2: number, z2: number, y = 0) => poly([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]])

  const far = px([0, 0, -400])
  const horizon = far ? far[1] : 0

  // Stands: far end and both sides (the near stand sits behind the camera)
  const aw = APRON_W / 2, al = APRON_L / 2
  const s0 = 2.2, s1 = 2.2 + ROWS * DEPTH, top = ROWS * RISE
  const stands = [
    poly([[-aw - 9, 0, -al - s0], [aw + 9, 0, -al - s0], [aw + 9, top, -al - s1], [-aw - 9, top, -al - s1]]),
    poly([[-aw - s0, 0, al], [-aw - s0, 0, -al - s0], [-aw - s1, top, -al - s1], [-aw - s1, top, al]]),
    poly([[aw + s0, 0, al], [aw + s0, 0, -al - s0], [aw + s1, top, -al - s1], [aw + s1, top, al]])
  ].filter(Boolean)

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
  const tx = aw + 11, tz = al + 11
  const lamps = ([[-tx, -tz], [tx, -tz], [-tx, tz], [tx, tz]] as const).flatMap(([x, z]) => {
    const p = px([x, 26.5, z])
    if (!p) return []
    const [, , d] = projectPoint([x, 26.5, z], cam, aspect)
    return [[p[0], p[1], r1(Math.max(2, (1.7 * h) / d))] as [number, number, number]]
  })

  let trail = ''
  let ball: Poster['ball'] = null
  let shadow: Poster['shadow'] = null
  if (withBall) {
    const pts = trailPoints(rally, 14).map(px).filter(Boolean) as Array<[number, number]>
    trail = pts.map(p => p.join(',')).join(' ')
    const b = px(rally.ball), s = px([rally.ball[0], 0, rally.ball[2]])
    const [, , d] = projectPoint(rally.ball, cam, aspect)
    const rad = r1(Math.max(2.5, (0.16 * h) / Math.max(1, d)))
    if (b) ball = [b[0], b[1], rad]
    if (s) shadow = [s[0], s[1], rad]
  }

  return {
    w, h, horizon, stands,
    apron: quad(-aw, -al, aw, al),
    court: quad(-C.doubles / 2, -C.half, C.doubles / 2, C.half),
    lines, net, band, posts, lamps, trail, ball, shadow
  }
}
