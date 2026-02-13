// https://nuxt.com/docs/api/configuration/nuxt-config
import { esES } from '@clerk/localizations'

export default defineNuxtConfig({
  compatibilityDate: '2024-01-01',
  devtools: { enabled: true },
  
  // Load CSS synchronously to prevent FOUC
  css: [
    '@/assets/css/design-system.css',
    '@/assets/css/main.css'
  ],
  
  // App configuration for better rendering
  app: {
    head: {
      htmlAttrs: {
        lang: 'es',
        class: 'dark'
      }
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  
  modules: [
    '@nuxt/ui',
    '@clerk/nuxt'
  ],

  clerk: {
    publishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    signInFallbackRedirectUrl: '/',
    redirectUrl: '/',
    localization: esES,
    // Removed custom appearance - using Clerk's default light theme
  },

  runtimeConfig: {
    public: {
      clerkPublishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    },
    clerkSecretKey: process.env.NUXT_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    openRouterApiKey: process.env.OPENROUTER_API_KEY
  },

  typescript: {
    strict: true,
    // Disable dev typeCheck when E2E_RUNNING=1 to avoid vite-plugin-checker overlay blocking clicks
    typeCheck: process.env.E2E_RUNNING === '1' ? false : true,
  },
})

