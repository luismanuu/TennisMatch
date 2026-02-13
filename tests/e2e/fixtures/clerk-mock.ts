import type { Route } from '@playwright/test'
import { test as base } from '@playwright/test'
import { e2eEnv } from '../env'
import { E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD, E2E_TEST_CLERK_ID } from './test-user'

function isSignInRequest(url: string, method: string): boolean {
  return method === 'POST' && (url.includes('/client/sign_in') || url.includes('sign_in'))
}

function credentialsMatch(body: Record<string, unknown> | null): boolean {
  if (!body || body?.password !== E2E_LOGIN_PASSWORD) return false
  const id = body.identifier ?? body.email_address ?? body.email
  return id === E2E_LOGIN_EMAIL
}

const successfulSignInBody = () => ({
  response: {
    id: E2E_TEST_CLERK_ID,
    email_addresses: [
      {
        id: 'idn_mock_e2e_123',
        email_address: E2E_LOGIN_EMAIL,
        verification: { status: 'verified' },
      },
    ],
    first_name: 'Test',
    last_name: 'User',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  client: {
    sessions: [
      {
        id: 'sess_mock_e2e_123',
        status: 'active',
        last_active_at: Date.now(),
      },
    ],
  },
})

// Mock Clerk API responses for E2E tests (uses e2e test user from test-user.ts)
export const test = base.extend({
  page: async ({ page }, use) => {
    async function handleClerkRoute(route: Route) {
      const url = route.request().url()
      const method = route.request().method()
      const body = method === 'POST' ? await route.request().postDataJSON() : null

      // Sign-in: match by path or by POST to a clerk URL with password in body (catch any Clerk host)
      const isSignIn =
        isSignInRequest(url, method) ||
        (method === 'POST' && url.includes('clerk') && body !== null && typeof body?.password === 'string')

      if (isSignIn) {
        if (credentialsMatch(body)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(successfulSignInBody()),
          })
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ errors: [{ message: 'Invalid credentials' }] }),
          })
        }
        return
      }

      if (url.includes('/client/sign_up') && method === 'POST') {
        const body = (await route.request().postDataJSON()) as Record<string, unknown> | null
        if (body?.email_address === 'existing@example.com') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ errors: [{ message: 'Email already exists' }] }),
          })
          return
        }
        if (body?.email_address && body?.password) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              response: {
                id: 'user_mock_e2e_456',
                email_addresses: [
                  { id: 'idn_mock_e2e_456', email_address: body.email_address, verification: { status: 'unverified' } },
                ],
                first_name: body.first_name || '',
                last_name: body.last_name || '',
                created_at: Date.now(),
                updated_at: Date.now(),
              },
              client: { sessions: [] },
            }),
          })
          return
        }
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ errors: [{ message: 'Invalid input' }] }),
        })
        return
      }

      if (url.includes('/me') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: E2E_TEST_CLERK_ID,
            email_addresses: [
              { id: 'idn_mock_e2e_123', email_address: E2E_LOGIN_EMAIL, verification: { status: 'verified' } },
            ],
            first_name: 'Test',
            last_name: 'User',
          }),
        })
        return
      }

      if (url.includes('/client/sessions') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sess_mock_e2e_123',
            status: 'active',
            last_active_at: Date.now(),
          }),
        })
        return
      }

      await route.continue()
    }

    if (!e2eEnv.useRealClerk) {
      await page.route('**/api.clerk.com/**', handleClerkRoute)
      await page.route('**/*.clerk.accounts.dev/**', handleClerkRoute)
      await page.route('**/v1/client/**', handleClerkRoute)
      await page.route('**/*sign_in*', handleClerkRoute)
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
