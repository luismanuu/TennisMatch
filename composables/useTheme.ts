/**
 * Theme system — three switchable themes, audited against the taste-skill rules
 * (one accent per theme, no cream+brass palette, sans display by default).
 *
 *  graphite  dark  · green-black ink, court-green accent, Geist + Geist Mono (chosen)
 *  slate     light · cool slate neutrals, rust accent, Archivo
 *  forest    dark  · deep green, bone text, amber accent, EB Garamond + Hanken Grotesk
 *
 * The active theme is written to `<html data-theme="…">`; every color token in
 * assets/css/design-system.css (and therefore every Tailwind semantic color)
 * follows it. The choice persists in a cookie so SSR renders the right theme
 * without a flash.
 *
 * To change the default for everyone, edit `theme.default` in app.config.ts.
 */
export type ThemeKey = 'graphite' | 'slate' | 'forest'

export interface ThemeMeta {
  key: ThemeKey
  name: string
  mode: 'dark' | 'light'
  description: string
  /** Browser UI color (address bar on mobile) */
  themeColor: string
  /** Google Fonts stylesheet for this theme's faces. Self-host before production (see DESIGN_SYSTEM.md). */
  fonts: string
  fontDisplay: string
  fontSans: string
}

export const THEMES: Record<ThemeKey, ThemeMeta> = {
  graphite: {
    key: 'graphite',
    name: 'Graphite',
    mode: 'dark',
    description: 'Tinta grafito con acento verde cancha',
    themeColor: '#0B1210',
    fonts: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
    fontDisplay: "'Geist', system-ui, -apple-system, sans-serif",
    fontSans: "'Geist', system-ui, -apple-system, sans-serif"
  },
  slate: {
    key: 'slate',
    name: 'Slate & Clay',
    mode: 'light',
    description: 'Gris pizarra claro con un acento de arcilla',
    themeColor: '#EEF0F2',
    fonts: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap',
    fontDisplay: "'Archivo', system-ui, -apple-system, sans-serif",
    fontSans: "'Archivo', system-ui, -apple-system, sans-serif"
  },
  forest: {
    key: 'forest',
    name: 'Forest',
    mode: 'dark',
    description: 'Verde profundo, texto hueso y un acento ámbar',
    themeColor: '#10201A',
    fonts: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600&family=Hanken+Grotesk:wght@400;500;600&display=swap',
    fontDisplay: "'EB Garamond', Georgia, serif",
    fontSans: "'Hanken Grotesk', system-ui, -apple-system, sans-serif"
  }
}

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

const isThemeKey = (v: unknown): v is ThemeKey => typeof v === 'string' && v in THEMES

export function useTheme() {
  const appConfig = useAppConfig() as { theme?: { default?: ThemeKey } }
  const fallback: ThemeKey = isThemeKey(appConfig.theme?.default) ? appConfig.theme!.default! : 'graphite'

  // Cookie = SSR-safe persistence (1 year)
  const cookie = useCookie<ThemeKey>('te-theme', {
    default: () => fallback,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })

  const theme = useState<ThemeKey>('te-theme', () => (isThemeKey(cookie.value) ? cookie.value : fallback))
  const meta = computed<ThemeMeta>(() => THEMES[theme.value])

  // Nuxt UI ships @nuxtjs/color-mode; keep its `dark`/`light` html class in step
  // so any `dark:` variants in the codebase still resolve.
  const colorMode = useColorMode()

  const apply = (key: ThemeKey) => {
    if (!isThemeKey(key)) return
    theme.value = key
    cookie.value = key
    colorMode.preference = THEMES[key].mode
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', key)
      document.documentElement.classList.toggle('dark', THEMES[key].mode === 'dark')
      document.documentElement.classList.toggle('light', THEMES[key].mode === 'light')
    }
  }

  const setTheme = (key: ThemeKey) => apply(key)
  const cycleTheme = () => {
    const idx = THEME_KEYS.indexOf(theme.value)
    apply(THEME_KEYS[(idx + 1) % THEME_KEYS.length])
  }

  // SSR + hydration: html attributes and fonts follow the active theme
  useHead(() => ({
    htmlAttrs: {
      'data-theme': theme.value,
      class: meta.value.mode
    },
    meta: [{ name: 'theme-color', content: meta.value.themeColor }],
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      { rel: 'stylesheet', href: meta.value.fonts, key: 'theme-fonts' }
    ]
  }))

  return { theme: readonly(theme), meta, themes: THEMES, themeKeys: THEME_KEYS, setTheme, cycleTheme }
}
