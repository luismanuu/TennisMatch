export default defineAppConfig({
  /**
   * Appearance served by default: 'graphite' | 'claro'.
   * Users switch in Ajustes (ThemeSwitcher); their choice is kept in the `te-theme` cookie.
   * See composables/useTheme.ts and assets/css/design-system.css.
   */
  theme: {
    default: 'graphite'
  },
  ui: {
    // Nuxt UI needs a hex palette for its own `primary` variables; `brand` lives in tailwind.config.ts
    primary: 'brand',
    gray: 'cool'
  }
})
