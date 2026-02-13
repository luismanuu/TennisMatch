import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// Set mock environment variables for Clerk (prevents errors in Nuxt environment)
process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing'
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing'

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: (req) => {
      try {
        const url = new URL(req.url.toString())
        // Allow OpenRouter API requests to pass through for LLM integration tests
        if (url.hostname === 'openrouter.ai' || url.hostname.includes('openrouter')) {
          return
        }
      } catch {
        // If URL parsing fails, fall through to error
      }
      // For other unhandled requests, throw error
      throw new Error(`[MSW] Unhandled request: ${req.method} ${req.url}`)
    }
  })
})

// Reset any request handlers that are declared as a part of our tests
// (i.e. for testing one-time error scenarios)
afterEach(() => {
  server.resetHandlers()
})

// Clean up after the tests are finished
afterAll(() => {
  server.close()
})

