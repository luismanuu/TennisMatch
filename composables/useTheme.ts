/**
 * Appearance runtime (DESIGN.md §3, DESIGN_SYSTEM.md §3).
 *
 *  graphite  dark  · green-black ink, court green (default)
 *  claro     light · the same identity with darker court green for contrast
 *
 * One authority: the `te-theme` cookie (SSR-safe). It sets `<html data-theme>`
 * plus the `dark`/`light` class and color-mode preference before hydration, so
 * no competing local-storage source exists. Geist is shared by both appearances.
 */
export type ThemeKey = 'graphite' | 'claro'

export interface ThemeMeta {
  key: ThemeKey
  name: string
  mode: 'dark' | 'light'
  description: string
  /** Browser UI color (address bar on mobile) */
  themeColor: string
}

export const THEMES: Record<ThemeKey, ThemeMeta> = {
  graphite: { key: 'graphite', name: 'Graphite', mode: 'dark', description: 'Tinta grafito con verde cancha', themeColor: '#0B1210' },
  claro: { key: 'claro', name: 'Claro', mode: 'light', description: 'La misma identidad con luz de día', themeColor: '#F0F4F1' }
}

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

/** Geist for both appearances. Self-host before production (DESIGN_SYSTEM.md §3). */
// impeccable-disable-next-line overused-font: DESIGN.md §5 pins "Geist throughout"
export const THEME_FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap'

/** Own-registry check: rejects prototype keys like `toString` and retired themes. */
export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v)

/** Legacy cookie values from the earlier three-theme scaffold map onto the two appearances. */
const LEGACY: Record<string, ThemeKey> = { slate: 'claro', forest: 'graphite' }

export const resolveThemeKey = (value: unknown, fallback: ThemeKey = 'graphite'): ThemeKey => {
  if (isThemeKey(value)) return value
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY, value)) return LEGACY[value]
  return fallback
}

export function useTheme() {
  const appConfig = useAppConfig() as { theme?: { default?: string } }
  const fallback = resolveThemeKey(appConfig.theme?.default)

  const cookie = useCookie<string>('te-theme', {
    default: () => fallback,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })

  const theme = useState<ThemeKey>('te-theme', () => resolveThemeKey(cookie.value, fallback))
  const meta = computed<ThemeMeta>(() => THEMES[theme.value])
  const colorMode = useColorMode()
  // Nuxt UI's color-mode keeps its own cookie and `dark` class. The appearance is the
  // single authority: mirror its mode into that cookie (so color-mode's pre-hydration
  // script agrees on the next load) and correct the class on this one.
  const modeCookie = useCookie<string>('te-color-mode', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

  const syncMode = (key: ThemeKey) => {
    const mode = THEMES[key].mode
    if (modeCookie.value !== mode) modeCookie.value = mode
    if (colorMode.preference !== mode) colorMode.preference = mode
    if (import.meta.client) {
      const root = document.documentElement
      root.setAttribute('data-theme', key)
      root.classList.toggle('dark', mode === 'dark')
      root.classList.toggle('light', mode === 'light')
    }
  }

  syncMode(theme.value)
  if (import.meta.client) onNuxtReady(() => syncMode(theme.value))

  const setTheme = (key: ThemeKey) => {
    if (!isThemeKey(key)) return
    theme.value = key
    cookie.value = key
    syncMode(key)
  }

  useHead(() => ({
    htmlAttrs: { 'data-theme': theme.value, class: meta.value.mode },
    meta: [{ name: 'theme-color', content: meta.value.themeColor }],
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      { rel: 'stylesheet', href: THEME_FONTS, key: 'theme-fonts' }
    ]
  }))

  return { theme: readonly(theme), meta, themes: THEMES, themeKeys: THEME_KEYS, setTheme }
}
