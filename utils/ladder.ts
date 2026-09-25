/**
 * Geometry for RankLadder: `n` rising steps (one per tier) laid out right-aligned
 * inside a `width × height` box. Heights rise monotonically from `min` to the full height.
 */
export interface Bar { x: number; y: number; w: number; h: number }

export function ladderBars(n: number, width: number, height: number, gap = 8, min = 0.18): Bar[] {
  const count = Math.max(0, Math.floor(n))
  if (count === 0 || width <= 0 || height <= 0) return []
  const g = Math.max(0, Math.min(gap, width / (count * 2)))
  const w = (width - g * (count - 1)) / count
  const lo = Math.min(Math.max(min, 0), 1)
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 1 : i / (count - 1)
    const h = height * (lo + (1 - lo) * t)
    return { x: i * (w + g), y: height - h, w, h }
  })
}
