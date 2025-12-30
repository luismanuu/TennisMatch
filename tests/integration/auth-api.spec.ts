import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { server } from './mocks/server'
import { http, HttpResponse } from 'msw'

const CLERK_API_BASE = 'https://api.clerk.com/v1'

describe('Authentication API HTTP Integration Tests', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('Sign In API HTTP Requests', () => {
    it('should successfully authenticate with valid credentials via HTTP', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'test@example.com',
          password: 'SecurePassword123!',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
      expect(data.response.id).toBeDefined()
      expect(data.response.email_addresses[0].email_address).toBe('test@example.com')
      expect(data.client.sessions).toBeDefined()
    })

    it('should reject authentication with invalid credentials via HTTP', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.errors).toBeDefined()
      expect(data.errors[0].message).toContain('Invalid credentials')
    })

    it('should handle missing credentials', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.errors).toBeDefined()
    })
  })

  describe('Sign Up API HTTP Requests', () => {
    it('should successfully create a new user via HTTP', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: 'newuser@example.com',
          password: 'SecurePassword123!',
          first_name: 'New',
          last_name: 'User',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
      expect(data.response.id).toBeDefined()
      expect(data.response.email_addresses[0].email_address).toBe('newuser@example.com')
      expect(data.response.first_name).toBe('New')
      expect(data.response.last_name).toBe('User')
    })

    it('should reject sign-up with missing required fields', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: 'test@example.com',
          // Missing password
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.errors).toBeDefined()
    })

    it('should allow sign-up with optional name fields', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sign_up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: 'user@example.com',
          password: 'SecurePassword123!',
          // No first_name or last_name
        }),
      })

      // Should still succeed as name fields are optional
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
    })
  })

  describe('Session Management HTTP Requests', () => {
    it('should verify user session via HTTP', async () => {
      const response = await fetch(`${CLERK_API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid_token',
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBeDefined()
      expect(data.email_addresses).toBeDefined()
    })

    it('should create a new session via HTTP', async () => {
      const response = await fetch(`${CLERK_API_BASE}/client/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'user_123',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBeDefined()
      expect(data.status).toBe('active')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Override handler to simulate network error
      server.use(
        http.post(`${CLERK_API_BASE}/client/sign_in`, () => {
          return HttpResponse.error()
        })
      )

      // MSW's HttpResponse.error() throws a NetworkError
      try {
        const response = await fetch(`${CLERK_API_BASE}/client/sign_in`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: 'test@example.com',
            password: 'password',
          }),
        })
        // If we get here, the error wasn't thrown, which is unexpected
        expect(response.ok).toBe(false)
      } catch (error) {
        // Network errors should be caught
        expect(error).toBeDefined()
      }
    })

    it('should handle server errors (500)', async () => {
      // Use a different endpoint or wait for handler to be applied
      server.use(
        http.post(`${CLERK_API_BASE}/client/sign_in`, async ({ request }) => {
          const body = await request.json() as { identifier?: string }
          // Only return 500 for specific test case
          if (body.identifier === 'test@example.com') {
            return HttpResponse.json(
              { error: 'Internal server error' },
              { status: 500 }
            )
          }
          // Fall through to default handler for other cases
        })
      )

      // Wait a bit for handler to be applied
      await new Promise(resolve => setTimeout(resolve, 10))

      const response = await fetch(`${CLERK_API_BASE}/client/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'test@example.com',
          password: 'testpassword',
        }),
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Internal server error')
    })
  })
})

