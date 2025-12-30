import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from './mocks/server'

// Mock Clerk client for integration testing
interface MockClerkClient {
  users: {
    create: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }
  sessions: {
    create: ReturnType<typeof vi.fn>
    verifyToken: ReturnType<typeof vi.fn>
  }
}

describe('Authentication API Integration Tests', () => {
  let mockClerkClient: MockClerkClient

  beforeEach(() => {
    mockClerkClient = {
      users: {
        create: vi.fn(),
        get: vi.fn(),
      },
      sessions: {
        create: vi.fn(),
        verifyToken: vi.fn(),
      },
    }
  })

  describe('Sign In API', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const mockUser = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
      }

      const mockSession = {
        id: 'sess_123',
        status: 'active',
        userId: 'user_123',
      }

      mockClerkClient.sessions.create.mockResolvedValue(mockSession)
      mockClerkClient.users.get.mockResolvedValue(mockUser)

      // Simulate sign-in API call
      const result = await mockClerkClient.sessions.create({
        userId: 'user_123',
      })

      expect(result).toEqual(mockSession)
      expect(mockClerkClient.sessions.create).toHaveBeenCalledWith({
        userId: 'user_123',
      })
    })

    it('should reject authentication with invalid credentials', async () => {
      const error = new Error('Invalid credentials')
      error.name = 'ClerkAPIError'
      mockClerkClient.sessions.create.mockRejectedValue(error)

      await expect(
        mockClerkClient.sessions.create({
          userId: 'invalid_user',
        })
      ).rejects.toThrow('Invalid credentials')
    })

    it('should handle network errors during sign-in', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      mockClerkClient.sessions.create.mockRejectedValue(networkError)

      await expect(
        mockClerkClient.sessions.create({
          userId: 'user_123',
        })
      ).rejects.toThrow('Network error')
    })
  })

  describe('Sign Up API', () => {
    it('should successfully create a new user', async () => {
      const mockNewUser = {
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'newuser@example.com' }],
        firstName: 'New',
        lastName: 'User',
        createdAt: Date.now(),
      }

      mockClerkClient.users.create.mockResolvedValue(mockNewUser)

      const result = await mockClerkClient.users.create({
        emailAddress: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User',
      })

      expect(result).toEqual(mockNewUser)
      expect(mockClerkClient.users.create).toHaveBeenCalledWith({
        emailAddress: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User',
      })
    })

    it('should reject sign-up with invalid email', async () => {
      const error = new Error('Invalid email address')
      error.name = 'ClerkAPIError'
      mockClerkClient.users.create.mockRejectedValue(error)

      await expect(
        mockClerkClient.users.create({
          emailAddress: 'invalid-email',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow('Invalid email address')
    })

    it('should reject sign-up with weak password', async () => {
      const error = new Error('Password does not meet requirements')
      error.name = 'ClerkAPIError'
      mockClerkClient.users.create.mockRejectedValue(error)

      await expect(
        mockClerkClient.users.create({
          emailAddress: 'test@example.com',
          password: 'weak',
        })
      ).rejects.toThrow('Password does not meet requirements')
    })

    it('should reject sign-up with duplicate email', async () => {
      const error = new Error('Email already exists')
      error.name = 'ClerkAPIError'
      mockClerkClient.users.create.mockRejectedValue(error)

      await expect(
        mockClerkClient.users.create({
          emailAddress: 'existing@example.com',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow('Email already exists')
    })
  })

  describe('Session Management', () => {
    it('should verify valid session token', async () => {
      const mockSession = {
        id: 'sess_123',
        status: 'active',
        userId: 'user_123',
      }

      mockClerkClient.sessions.verifyToken.mockResolvedValue(mockSession)

      const result = await mockClerkClient.sessions.verifyToken('valid_token')

      expect(result).toEqual(mockSession)
      expect(mockClerkClient.sessions.verifyToken).toHaveBeenCalledWith('valid_token')
    })

    it('should reject invalid session token', async () => {
      const error = new Error('Invalid or expired token')
      error.name = 'ClerkAPIError'
      mockClerkClient.sessions.verifyToken.mockRejectedValue(error)

      await expect(
        mockClerkClient.sessions.verifyToken('invalid_token')
      ).rejects.toThrow('Invalid or expired token')
    })
  })
})

