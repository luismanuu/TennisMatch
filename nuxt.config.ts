// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-01-01',
  devtools: { enabled: true },
  
  // Load CSS synchronously to prevent FOUC
  css: [
    '@/assets/css/design-system.css',
    '@/assets/css/main.css',
    // Tablero world (DESIGN.md): scoped to `.tablero`, inert on routes that have not opted in
    '@/assets/css/tablero.css'
  ],
  
  // App configuration for better rendering
  app: {
    head: {
      htmlAttrs: {
        lang: 'es'
        // data-theme + dark/light class are set by composables/useTheme.ts
      }
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  
  modules: [
    '@nuxt/ui'
  ],

  // Nuxt UI ships @nuxtjs/color-mode; the appearance (te-theme) drives dark/light (see useTheme).
  // Cookie storage lets SSR render the right class instead of patching it after hydration.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
    storage: 'cookie',
    storageKey: 'te-color-mode'
  },


  // Nitro 2 emits one Vercel function for every route, so this cap covers the monthly-decay cron and the
  // slowest request path alike (score approval can wait on the LLM for ~96 s). 300 s is the project's
  // current fluid-compute default on the Pro plan, made explicit.
  nitro: { vercel: { functions: { maxDuration: 300 } } },

  runtimeConfig: {
    public: {},
    openRouterApiKey: process.env.OPENROUTER_API_KEY
  },

  typescript: {
    strict: true,
    typeCheck: false // Disable type checking during dev to avoid vue-tsc issues
  }
})

