/**
 * E2E test environment variables.
 * Do not use .env for these; set them in the shell or via Playwright webServer.env when running e2e.
 *
 * Variables:
 * - NUXT_E2E_ENSURE_TEST_USER: set to '1' to enable the ensure-test-user API (idempotent create of test player)
 * - E2E_DEFAULT_CITY_ID: optional; default city for test user (else first row in DB)
 * - E2E_DEFAULT_CATEGORY_ID: optional; default category for test user (else first row in DB)
 * - PLAYWRIGHT_TEST_BASE_URL: optional; base URL for tests (default http://localhost:3000)
 * - E2E_USE_REAL_CLERK: set to '1' to run sign-in e2e against real Clerk (no mock); requires E2E_CLERK_* below
 * - E2E_CLERK_EMAIL, E2E_CLERK_PASSWORD, E2E_CLERK_ID: real Clerk test user (required when E2E_USE_REAL_CLERK=1)
 */

export const E2E_ENV_KEYS = {
  ensureTestUser: 'NUXT_E2E_ENSURE_TEST_USER',
  defaultCityId: 'E2E_DEFAULT_CITY_ID',
  defaultCategoryId: 'E2E_DEFAULT_CATEGORY_ID',
  baseURL: 'PLAYWRIGHT_TEST_BASE_URL',
  /** Set by Playwright webServer so Nuxt disables type-check overlay during e2e (avoids overlay blocking clicks). */
  running: 'E2E_RUNNING',
  useRealClerk: 'E2E_USE_REAL_CLERK',
  clerkEmail: 'E2E_CLERK_EMAIL',
  clerkPassword: 'E2E_CLERK_PASSWORD',
  clerkId: 'E2E_CLERK_ID',
} as const

/**
 * Resolved E2E env values (from process.env). Use in tests and config.
 */
export const e2eEnv = {
  get ensureTestUserEnabled(): boolean {
    return process.env[E2E_ENV_KEYS.ensureTestUser] === '1'
  },
  get defaultCityId(): string | undefined {
    return process.env[E2E_ENV_KEYS.defaultCityId]
  },
  get defaultCategoryId(): string | undefined {
    return process.env[E2E_ENV_KEYS.defaultCategoryId]
  },
  get baseURL(): string {
    return process.env[E2E_ENV_KEYS.baseURL] || 'http://localhost:3000'
  },
  get useRealClerk(): boolean {
    return process.env[E2E_ENV_KEYS.useRealClerk] === '1'
  },
} as const

/**
 * Env object to pass to Playwright webServer so the Nuxt dev server sees E2E vars.
 * Use in playwright.config.ts: webServer: { ... existing, env: e2eEnvForWebServer }
 */
export const e2eEnvForWebServer: Record<string, string> = {
  [E2E_ENV_KEYS.ensureTestUser]: '1',
  [E2E_ENV_KEYS.running]: '1',
}
