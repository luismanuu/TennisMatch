/**
 * Scroll motion primitives for the Tablero world (DESIGN.md "Motion"). Deterministic and
 * DOM-free so they can be property-tested; composables/useScrub.ts only reads from them.
 */

export const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

/**
 * Progress through a pinned section: 0 when its top reaches the viewport top,
 * 1 when its bottom reaches the viewport bottom. A section no taller than the
 * viewport has no scroll distance and reads as complete once its top passes.
 */
export function sectionProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport
  if (!(travel > 0)) return top <= 0 ? 1 : 0
  return clamp01(-top / travel)
}

/**
 * Frame-rate independent smoothing toward a target: after `dt` ms the gap has
 * shrunk by half every `halfLife` ms. Snaps when the gap is below `epsilon`, so a
 * resting page stops requesting frames.
 */
export function smoothToward(current: number, target: number, dt: number, halfLife = 90, epsilon = 0.0005): number {
  if (!Number.isFinite(current)) return target
  if (!Number.isFinite(target)) return current
  const gap = target - current
  if (Math.abs(gap) < epsilon || !(halfLife > 0)) return target
  // A first rAF frame can hand over an undefined/NaN delta: treat it as no time passed.
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
  const k = 1 - Math.pow(2, -elapsed / halfLife)
  const next = current + gap * k
  return Math.abs(target - next) < epsilon ? target : next
}
