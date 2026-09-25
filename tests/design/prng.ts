/** Seeded generator helpers for property tests (fixed seed in CI; override with PROPERTY_SEED). */
export const SEED = Number(process.env.PROPERTY_SEED ?? 20260925)

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
export const int = (rand: () => number, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

const ALPHABET = ['a', 'z', 'G', '0', '9', '_', '-', ' ', 'ñ', 'é', '🎾', '$', '/', '.']
export const str = (rand: () => number, max = 16) =>
  Array.from({ length: int(rand, 0, max) }, () => pick(rand, ALPHABET)).join('')
