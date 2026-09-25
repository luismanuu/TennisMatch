import type { Config } from 'tailwindcss'

/**
 * Tailwind ↔ design-system bridge.
 *
 * Every semantic color here reads a CSS variable defined per theme in
 * assets/css/design-system.css (`--*-ch` = OKLCH channels without the
 * function wrapper, so Tailwind can inject its `/opacity` modifier).
 * Switching `<html data-theme>` re-colors every `bg-surface`, `border-accent/30`,
 * `text-foreground-muted`… without touching a single template.
 *
 * The raw palette hues the codebase leans on (green-400, red-500, yellow-400 …)
 * are remapped to theme-tuned bases using CSS relative color syntax, so a
 * `text-green-400` badge stays legible on Claro and stays
 * calm on Graphite. New code should prefer the semantic names
 * (`text-success`, `bg-warning/10`, `border-danger/30`, `text-info`).
 */

const ch = (name: string) => `oklch(var(--${name}-ch) / <alpha-value>)`

/** Lightness offsets from the theme's base hue color, per Tailwind shade. */
const SHADE_DL: Record<number, number> = {
  50: 0.40, 100: 0.34, 200: 0.26, 300: 0.16, 400: 0.08,
  500: 0, 600: -0.08, 700: -0.16, 800: -0.24, 900: -0.30, 950: -0.36
}
const hueScale = (hue: string) =>
  Object.fromEntries(
    Object.entries(SHADE_DL).map(([shade, dl]) => [
      shade,
      dl === 0
        ? `oklch(from var(--hue-${hue}) l c h / <alpha-value>)`
        : `oklch(from var(--hue-${hue}) calc(l ${dl > 0 ? '+' : '-'} ${Math.abs(dl)}) c h / <alpha-value>)`
    ])
  )

/**
 * `accent-subtle` keeps the 14% base tint and multiplies Tailwind's opacity modifier
 * in CSS, so variable modifiers (`var(--tw-bg-opacity)`) survive untouched.
 */
export const accentSubtle = ({ opacityValue }: { opacityValue?: string }) =>
  opacityValue === undefined || opacityValue === '1'
    ? 'var(--accent-subtle)'
    : `oklch(var(--accent-ch) / calc(0.14 * ${opacityValue}))`

/** Static hex scale for Nuxt UI's `primary` (it needs hex to build its own vars). Court green, the chosen accent. */
const brand = {
  50: '#EEF9F3', 100: '#D6F1E2', 200: '#AEE3C6', 300: '#7FD2A6', 400: '#59C58D',
  500: '#3FBA78', 600: '#2F9961', 700: '#25784D', 800: '#1D5C3C', 900: '#16452E', 950: '#0B2419'
}

export default <Partial<Config>>{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand,
        background: ch('background'),
        'background-subtle': ch('background-subtle'),
        surface: ch('surface'),
        'surface-elevated': ch('surface-elevated'),
        'surface-high': ch('surface-high'),
        foreground: ch('foreground'),
        'foreground-muted': ch('foreground-muted'),
        'foreground-subtle': ch('foreground-subtle'),
        accent: ch('accent'),
        'accent-hover': ch('accent-hover'),
        'accent-foreground': ch('accent-foreground'),
        // DESIGN_SYSTEM.md §2: unmodified subtle = 0.14; `accent-subtle/30` = 0.14 × 0.30.
        'accent-subtle': accentSubtle,
        'accent-secondary': ch('accent-secondary'),
        'accent-secondary-muted': 'var(--accent-secondary-muted)',
        border: ch('border'),
        'border-subtle': ch('border-subtle'),
        'border-muted': ch('border-muted'),
        hairline: 'var(--hairline)',
        success: ch('success'),
        warning: ch('warning'),
        danger: ch('danger'),
        info: ch('info'),
        // Theme-tuned remaps of the raw hues already used across pages/components
        green: hueScale('green'),
        emerald: hueScale('green'),
        red: hueScale('red'),
        yellow: hueScale('yellow'),
        amber: hueScale('amber'),
        orange: hueScale('orange'),
        blue: hueScale('blue'),
        indigo: hueScale('indigo'),
        purple: hueScale('purple'),
        cyan: hueScale('cyan'),
        gray: hueScale('gray')
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        glow: '0 8px 24px -8px var(--glow-accent)'
      },
      letterSpacing: {
        eyebrow: '0.14em'
      },
      spacing: {
        nav: 'var(--nav-h)',
        tabbar: 'var(--tabbar-h)'
      }
    }
  }
}
