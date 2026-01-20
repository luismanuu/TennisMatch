// https://nuxt.com/docs/api/configuration/nuxt-config
import { esES } from '@clerk/localizations'

export default defineNuxtConfig({
  compatibilityDate: '2024-01-01',
  devtools: { enabled: true },
  
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
    // @ts-ignore - localization is supported but not in types yet
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
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  typescript: {
    strict: true,
    typeCheck: false // Disable type checking during dev to avoid vue-tsc issues
  }
})

