/**
 * E2E login test user — single source of truth.
 * Used by clerk-mock and ensure-test-user API. Player is ensured via API (idempotent) before login tests.
 * When E2E_USE_REAL_CLERK=1, email/password/clerkId are read from E2E_CLERK_EMAIL, E2E_CLERK_PASSWORD, E2E_CLERK_ID.
 */
import { E2E_ENV_KEYS } from '../env'

export const E2E_LOGIN_EMAIL = 'test@example.com'
export const E2E_LOGIN_PASSWORD = 'SecurePassword123!'
export const E2E_TEST_CLERK_ID = 'user_mock_e2e_123'

function useRealClerk(): boolean {
  return process.env[E2E_ENV_KEYS.useRealClerk] === '1'
}

function requireRealClerkEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is required when E2E_USE_REAL_CLERK=1`)
  return v
}

export const e2eTestUser = {
  get email(): string {
    return useRealClerk() ? requireRealClerkEnv(E2E_ENV_KEYS.clerkEmail) : E2E_LOGIN_EMAIL
  },
  get password(): string {
    return useRealClerk() ? requireRealClerkEnv(E2E_ENV_KEYS.clerkPassword) : E2E_LOGIN_PASSWORD
  },
  get clerkId(): string {
    return useRealClerk() ? requireRealClerkEnv(E2E_ENV_KEYS.clerkId) : E2E_TEST_CLERK_ID
  },
}
