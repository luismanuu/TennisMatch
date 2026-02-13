/**
 * Server-side plugin to validate environment variables at startup
 * This runs before the application starts and fails fast if env vars are invalid
 */
export default defineNuxtPlugin(async () => {
  if (process.server) {
    try {
      const { validateEnv } = await import('~/server/utils/env-validation')
      validateEnv()
    } catch (error) {
      console.error('❌ Environment validation failed:', error)
      throw error
    }
  }
})
