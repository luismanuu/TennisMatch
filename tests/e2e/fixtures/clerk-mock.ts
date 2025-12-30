import { test as base } from '@playwright/test'

// Mock Clerk API responses for E2E tests
export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept Clerk API calls
    await page.route('**/api.clerk.com/**', async (route) => {
      const url = route.request().url()
      const method = route.request().method()
      
      // Mock sign-in endpoint
      if (url.includes('/client/sign_in') && method === 'POST') {
        const body = await route.request().postDataJSON()
        
        // Check if credentials are valid
        if (body?.identifier === 'test@example.com' && body?.password === 'SecurePassword123!') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              response: {
                id: 'user_mock_e2e_123',
                email_addresses: [
                  {
                    id: 'idn_mock_e2e_123',
                    email_address: body.identifier,
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
            }),
          })
        } else {
          // Invalid credentials
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Invalid credentials' }],
            }),
          })
        }
        return
      }
      
      // Mock sign-up endpoint
      if (url.includes('/client/sign_up') && method === 'POST') {
        const body = await route.request().postDataJSON()
        
        // Check for duplicate email
        if (body?.email_address === 'existing@example.com') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Email already exists' }],
            }),
          })
          return
        }
        
        // Successful sign-up
        if (body?.email_address && body?.password) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              response: {
                id: 'user_mock_e2e_456',
                email_addresses: [
                  {
                    id: 'idn_mock_e2e_456',
                    email_address: body.email_address,
                    verification: { status: 'unverified' },
                  },
                ],
                first_name: body.first_name || '',
                last_name: body.last_name || '',
                created_at: Date.now(),
                updated_at: Date.now(),
              },
              client: {
                sessions: [],
              },
            }),
          })
          return
        }
        
        // Missing required fields
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Invalid input' }],
          }),
        })
        return
      }
      
      // Mock session verification
      if (url.includes('/me') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user_mock_e2e_123',
            email_addresses: [
              {
                id: 'idn_mock_e2e_123',
                email_address: 'test@example.com',
                verification: { status: 'verified' },
              },
            ],
            first_name: 'Test',
            last_name: 'User',
          }),
        })
        return
      }
      
      // Mock session creation
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
      
      // Default: continue with original request (for other Clerk endpoints)
      await route.continue()
    })
    
    await use(page)
  },
})

export { expect } from '@playwright/test'

