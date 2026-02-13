import { http, HttpResponse, passthrough } from 'msw'

const CLERK_API_BASE = 'https://api.clerk.com/v1'
const OPENROUTER_API_BASE = 'https://openrouter.ai'

// Mock Clerk API responses
export const handlers = [
  // Mock sign-in endpoint
  http.post(`${CLERK_API_BASE}/client/sign_in`, async ({ request }) => {
    const body = await request.json() as { identifier?: string; password?: string }
    
    // Simulate successful sign-in only for valid credentials
    if (body.identifier === 'test@example.com' && body.password === 'SecurePassword123!') {
      return HttpResponse.json({
        response: {
          id: 'user_mock123',
          email_addresses: [
            {
              id: 'idn_mock123',
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
              id: 'sess_mock123',
              status: 'active',
              last_active_at: Date.now(),
            },
          ],
        },
      }, { status: 200 })
    }
    
    // Simulate failed sign-in for invalid credentials or missing fields
    if (!body.identifier || !body.password) {
      return HttpResponse.json(
        { errors: [{ message: 'Missing credentials' }] },
        { status: 401 }
      )
    }
    
    // Invalid credentials
    return HttpResponse.json(
      { errors: [{ message: 'Invalid credentials' }] },
      { status: 401 }
    )
  }),

  // Mock sign-up endpoint
  http.post(`${CLERK_API_BASE}/client/sign_up`, async ({ request }) => {
    const body = await request.json() as { 
      email_address?: string
      password?: string
      first_name?: string
      last_name?: string
    }
    
    // Simulate successful sign-up
    if (body.email_address && body.password) {
      return HttpResponse.json({
        response: {
          id: 'user_mock456',
          email_addresses: [
            {
              id: 'idn_mock456',
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
      }, { status: 200 })
    }
    
    // Simulate failed sign-up
    return HttpResponse.json(
      { errors: [{ message: 'Invalid input' }] },
      { status: 400 }
    )
  }),

  // Mock session verification endpoint
  http.get(`${CLERK_API_BASE}/me`, () => {
    return HttpResponse.json({
      id: 'user_mock123',
      email_addresses: [
        {
          id: 'idn_mock123',
          email_address: 'test@example.com',
          verification: { status: 'verified' },
        },
      ],
      first_name: 'Test',
      last_name: 'User',
    }, { status: 200 })
  }),

  // Mock session creation endpoint
  http.post(`${CLERK_API_BASE}/client/sessions`, () => {
    return HttpResponse.json({
      id: 'sess_mock123',
      status: 'active',
      last_active_at: Date.now(),
    }, { status: 200 })
  }),

  // Passthrough for OpenRouter API - allow real API calls for LLM integration tests
  http.all(`${OPENROUTER_API_BASE}/*`, () => {
    return passthrough()
  }),
]

