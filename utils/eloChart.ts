/**
 * Geometry for the SR history chart (components/EloHistoryChart.vue). Pure so the
 * layout invariants are property-tested (tests/design/elo-chart.test.ts).
 *
 * Entries are grouped by calendar day (Ecuador time by default); each day gets an
 * equal x step and several matches on one day spread slightly around it.
 */
export interface HistoryEntry { id?: string; elo_after: number; elo_before: number; created_at: string }
export interface ChartBox { width: number; height: number; padding: { top: number; right: number; bottom: number; left: number } }
export interface ChartPoint { x: number; y: number; elo: number; change: number; dayIndex: number; date: string }

/** Minimum horizontal distance between x-axis date labels, in viewBox units. */
export const MIN_LABEL_GAP = 36

export const ecuadorDayKey = (iso: string) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Guayaquil' }))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Y domain padded by 10% (at least 50 SR) and snapped outward to multiples of 50. */
export function eloDomain(elos: number[]): { min: number; max: number } {
  const finite = elos.filter(Number.isFinite)
  if (!finite.length) return { min: 1000, max: 1500 }
  const lo = Math.min(...finite)
  const hi = Math.max(...finite)
  const buffer = Math.max((hi - lo) * 0.1, 50)
  return { min: Math.floor((lo - buffer) / 50) * 50, max: Math.ceil((hi + buffer) / 50) * 50 }
}

export function buildEloChart(history: HistoryEntry[], box: ChartBox, dayKey: (iso: string) => string = ecuadorDayKey) {
  const { width, height, padding } = box
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const valid = (history || []).filter(e => Number.isFinite(e?.elo_after) && !Number.isNaN(new Date(e?.created_at).getTime()))
  const groups = new Map<string, HistoryEntry[]>()
  for (const e of valid) {
    const k = dayKey(e.created_at)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }
  const days = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entries]) => ({ key, entries: [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) }))

  const domain = eloDomain(valid.map(e => e.elo_after))
  const span = domain.max - domain.min || 1
  const step = days.length > 1 ? plotW / (days.length - 1) : 0
  const scaleY = (elo: number) => padding.top + (1 - (elo - domain.min) / span) * plotH

  const points: ChartPoint[] = []
  days.forEach((day, dayIndex) => {
    const n = day.entries.length
    const base = days.length > 1 ? padding.left + dayIndex * step : padding.left + plotW / 2
    const spread = n > 1 ? Math.min((step || plotW) * 0.3, 15) : 0
    day.entries.forEach((e, i) => {
      const offset = n > 1 ? (i - (n - 1) / 2) * (spread / (n - 1)) : 0
      const x = Math.min(padding.left + plotW, Math.max(padding.left, base + offset))
      points.push({ x, y: scaleY(e.elo_after), elo: e.elo_after, change: e.elo_after - e.elo_before, dayIndex, date: e.created_at })
    })
  })

  const f = (n: number) => Math.round(n * 100) / 100
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ')
  const baseline = height - padding.bottom
  const area = points.length
    ? `M${f(points[0].x)} ${f(baseline)} ${points.map(p => `L${f(p.x)} ${f(p.y)}`).join(' ')} L${f(points[points.length - 1].x)} ${f(baseline)} Z`
    : ''
  const yTicks = [0, 1, 2, 3, 4].map(i => {
    const value = Math.round(domain.max - (i * span) / 4)
    return { value, y: padding.top + (i * plotH) / 4 }
  })
  const labelStep = days.length <= 5 ? 1 : Math.ceil(days.length / 5)
  const xLabels = days
    .map((d, i) => ({ i, date: d.entries[0].created_at }))
    .filter(({ i }) => i % labelStep === 0 || i === days.length - 1)
    .map(({ i, date }) => ({ x: days.length > 1 ? padding.left + i * step : padding.left + plotW / 2, date }))
    // Keep the last label (latest date) and drop any earlier one closer than MIN_LABEL_GAP to its right neighbour
    .reduceRight<{ x: number; date: string }[]>((kept, l) => (kept.length && kept[0].x - l.x < MIN_LABEL_GAP ? kept : [l, ...kept]), [])

  return { points, line, area, yTicks, xLabels, domain }
}
