/**
 * Geometry for the animated court graphic (components/CourtLines.vue).
 * A regulation court seen from above, length along x: 78 ft long, 36 ft doubles
 * width, 27 ft singles width, service lines 21 ft from the net.
 */
export interface Segment { x1: number; y1: number; x2: number; y2: number }
export interface Point { x: number; y: number }

export const COURT = { length: 78, doubles: 36, singles: 27, service: 21 } as const

/** Court line segments scaled into a `width × height` box with `pad` inset on every side. */
export function courtSegments(width: number, height: number, pad = 0): Segment[] {
  const w = Math.max(0, width - 2 * pad)
  const h = Math.max(0, height - 2 * pad)
  const sx = w / COURT.length
  const sy = h / COURT.doubles
  const X = (ft: number) => pad + ft * sx
  const Y = (ft: number) => pad + ft * sy
  const alley = (COURT.doubles - COURT.singles) / 2
  const net = COURT.length / 2
  const s1 = net - COURT.service
  const s2 = net + COURT.service
  const mid = COURT.doubles / 2
  return [
    { x1: X(0), y1: Y(0), x2: X(COURT.length), y2: Y(0) },
    { x1: X(0), y1: Y(COURT.doubles), x2: X(COURT.length), y2: Y(COURT.doubles) },
    { x1: X(0), y1: Y(0), x2: X(0), y2: Y(COURT.doubles) },
    { x1: X(COURT.length), y1: Y(0), x2: X(COURT.length), y2: Y(COURT.doubles) },
    { x1: X(0), y1: Y(alley), x2: X(COURT.length), y2: Y(alley) },
    { x1: X(0), y1: Y(COURT.doubles - alley), x2: X(COURT.length), y2: Y(COURT.doubles - alley) },
    { x1: X(s1), y1: Y(alley), x2: X(s1), y2: Y(COURT.doubles - alley) },
    { x1: X(s2), y1: Y(alley), x2: X(s2), y2: Y(COURT.doubles - alley) },
    { x1: X(s1), y1: Y(mid), x2: X(s2), y2: Y(mid) },
    { x1: X(net), y1: Y(0), x2: X(net), y2: Y(COURT.doubles) }
  ]
}

/** Point on a quadratic Bézier at t ∈ [0, 1]. */
export function quadAt(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y }
}

/**
 * Control point for a shot from `from` to `to` whose highest point sits `lift` px
 * above the higher endpoint (smaller y is higher on screen).
 */
export function arcControl(from: Point, to: Point, lift: number): Point {
  const top = Math.min(from.y, to.y) - Math.max(0, lift)
  // Apex of a quadratic with endpoints p0, p1 and control c is at y = (p0*p1 - c²)/(p0 + p1 - 2c)
  // when it lies inside the segment; solve for c so the apex equals `top`.
  const a = from.y - top
  const b = to.y - top
  const cy = a === 0 || b === 0 ? top : top - Math.sqrt(a * b)
  return { x: (from.x + to.x) / 2, y: cy }
}

/** SVG path for the shot arc. */
export function arcPath(from: Point, to: Point, lift: number): string {
  const c = arcControl(from, to, lift)
  const f = (n: number) => Math.round(n * 100) / 100
  return `M${f(from.x)} ${f(from.y)} Q${f(c.x)} ${f(c.y)} ${f(to.x)} ${f(to.y)}`
}
