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
    appearance: {
      variables: {
        colorPrimary: 'oklch(0.70 0.22 150)',
        colorBackground: 'oklch(0.20 0.01 250)',
        colorInputBackground: 'oklch(0.145 0 0)',
        colorInputText: 'oklch(0.95 0 0)',
        colorText: 'oklch(0.95 0 0)',
        colorTextSecondary: 'oklch(0.70 0.01 250)',
        borderRadius: '0.5rem'
      },
      elements: {
        formButtonPrimary: {
          backgroundColor: 'oklch(0.95 0 0)',
          color: 'oklch(0.13 0 0)',
          fontSize: '0.875rem',
          fontWeight: '600',
          padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem',
          transition: 'all 150ms ease',
          '&:hover': {
            backgroundColor: 'oklch(0.70 0.22 150)',
            color: 'oklch(0.13 0 0)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 20px -4px oklch(0.70 0.22 150 / 0.4)'
          },
          '&:active': {
            backgroundColor: 'oklch(0.65 0.20 150)',
            transform: 'translateY(0)'
          }
        }
      }
    }
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

