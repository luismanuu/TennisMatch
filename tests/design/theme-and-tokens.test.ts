import { describe, expect, it } from 'vitest'
import { THEME_KEYS, THEMES, isThemeKey, resolveThemeKey } from '../../composables/useTheme'
import { accentSubtle } from '../../tailwind.config'
import { SEED, int, mulberry32, pick, str } from './prng'

const RUNS = 2000
const HOSTILE = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '', ' graphite', 'GRAPHITE', 'claro ', 'forest', 'slate', 'cobalt', 'null', 'undefined']

/** Any value a cookie, app.config or a caller could hand the resolver. */
function arbitraryValue(rand: () => number): unknown {
  switch (int(rand, 0, 6)) {
    case 0: return pick(rand, THEME_KEYS)
    case 1: return pick(rand, HOSTILE)
    case 2: return str(rand)
    case 3: return int(rand, -5, 5)
    case 4: return rand() < 0.5 ? null : undefined
    case 5: return { toString: () => 'graphite' }
    default: return [pick(rand, THEME_KEYS)]
  }
}

describe('resolveThemeKey (property)', () => {
  it('always lands on a registered appearance, keeps valid keys, and only maps the two legacy themes', () => {
    const rand = mulberry32(SEED)
    for (let i = 0; i < RUNS; i++) {
      const value = arbitraryValue(rand)
      const fallback = pick(rand, THEME_KEYS)
      const out = resolveThemeKey(value, fallback)
      expect(Object.prototype.hasOwnProperty.call(THEMES, out)).toBe(true)
      if (typeof value === 'string' && THEME_KEYS.includes(value as never)) expect(out).toBe(value)
      else if (value === 'slate') expect(out).toBe('claro')
      else if (value === 'forest') expect(out).toBe('graphite')
      else expect(out).toBe(fallback)
    }
  })

  it('isThemeKey accepts exactly the registry keys', () => {
    const rand = mulberry32(SEED + 1)
    for (let i = 0; i < RUNS; i++) {
      const value = arbitraryValue(rand)
      expect(isThemeKey(value)).toBe(typeof value === 'string' && THEME_KEYS.includes(value as never))
    }
  })

  it('every appearance declares a mode that matches its color scheme', () => {
    for (const key of THEME_KEYS) expect(['dark', 'light']).toContain(THEMES[key].mode)
    expect(THEMES.graphite.mode).toBe('dark')
    expect(THEMES.claro.mode).toBe('light')
  })
})

/** Evaluates the alpha that the CSS `calc(0.14 * x)` produces for a numeric modifier. */
function alphaOf(css: string): number {
  if (css === 'var(--accent-subtle)') return 0.14
  const m = css.match(/^oklch\(var\(--accent-ch\) \/ calc\(0\.14 \* ([0-9.]+)\)\)$/)
  if (!m) throw new Error(`unexpected accent-subtle output: ${css}`)
  return 0.14 * Number(m[1])
}

describe('accent-subtle bridge (property, DESIGN_SYSTEM.md §2)', () => {
  it('unmodified is the 14% base; a modifier x yields 0.14 × x, monotonic and never above the base', () => {
    const rand = mulberry32(SEED + 2)
    expect(alphaOf(accentSubtle({}))).toBeCloseTo(0.14, 10)
    for (let i = 0; i < RUNS; i++) {
      const a = Math.round(rand() * 100) / 100
      const b = Math.round(rand() * 100) / 100
      const alphaA = alphaOf(accentSubtle({ opacityValue: String(a) }))
      const alphaB = alphaOf(accentSubtle({ opacityValue: String(b) }))
      expect(alphaA).toBeCloseTo(0.14 * a, 10)
      expect(alphaA).toBeLessThanOrEqual(0.14 + 1e-12)
      if (a < b) expect(alphaA).toBeLessThan(alphaB)
    }
  })

  it('passes a CSS variable modifier through untouched instead of coercing it to a number', () => {
    expect(accentSubtle({ opacityValue: 'var(--tw-bg-opacity)' })).toBe('oklch(var(--accent-ch) / calc(0.14 * var(--tw-bg-opacity)))')
  })

  it('regression: subtle/30 is 0.042, not the old 0.5 multiplier (0.15)', () => {
    expect(alphaOf(accentSubtle({ opacityValue: '0.3' }))).toBeCloseTo(0.042, 10)
  })
})
