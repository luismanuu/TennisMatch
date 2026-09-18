export default defineAppConfig({
  /**
   * Visual theme served by default: 'graphite' | 'slate' | 'forest'.
   * Users can still switch at runtime (ThemeSwitcher); their choice is kept in a cookie.
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
