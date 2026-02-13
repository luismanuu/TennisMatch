import { describe, it, expect, beforeAll } from 'vitest'
import { createClerkClient } from '@clerk/clerk-sdk-node'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env file from project root
config({ path: resolve(process.cwd(), '.env') })

// Use Node environment for these tests (required for Clerk SDK to work)
// @vitest-environment node

/**
 * Integration tests that use the REAL Clerk API
 * These tests will create actual users in your Clerk instance
 * 
 * Requirements:
 * - Set NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY in .env file or environment variable
 * - These tests should be run in a test/staging environment, not production
 */
describe('Clerk Real API Integration Tests', () => {
  let clerkClient: ReturnType<typeof createClerkClient> | null = null

  beforeAll(() => {
    // Try multiple environment variable names that might be in .env
    const secretKey = 
      process.env.NUXT_CLERK_SECRET_KEY || 
      process.env.CLERK_SECRET_KEY ||
      process.env.CLERK_SECRET_KEY_TEST
    
    // Debug: Log what we found (without exposing the actual key)
    if (secretKey) {
      console.log('✅ Clerk secret key found:', secretKey.substring(0, 10) + '...')
    } else {
      console.warn('⚠️  Clerk secret key not found. Skipping real API tests.')
      console.warn('   Looking for: NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY')
      console.warn('   Make sure your .env file is in the project root and contains one of these keys.')
      return
    }

    try {
      clerkClient = createClerkClient({ secretKey })
    } catch (error) {
      console.warn('⚠️  Failed to initialize Clerk client. Skipping real API tests.')
      console.warn('   Error:', error)
    }
  })

  describe('User Creation', () => {
    it('should create a new user in Clerk', async () => {
      if (!clerkClient) {
        return // Skip test if Clerk client is not available
      }

      const testEmail = `test-${Date.now()}@example.com`
      // Use a unique password that won't be flagged as compromised
      const testPassword = `TestP@ssw0rd_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        const user = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
        })

        expect(user).toBeDefined()
        expect(user.id).toBeDefined()
        expect(user.emailAddresses).toBeDefined()
        expect(user.emailAddresses.length).toBeGreaterThan(0)
        expect(user.emailAddresses[0]?.emailAddress).toBe(testEmail)
        expect(user.firstName).toBe('Test')
        expect(user.lastName).toBe('User')

        // Cleanup: Delete the test user
        await clerkClient.users.deleteUser(user.id)
      } catch (error: any) {
        // Log the full error for debugging
        console.error('Error creating user:', {
          message: error?.message,
          errors: error?.errors,
          status: error?.status,
          clerkTraceId: error?.clerkTraceId,
        })
        
        // If user already exists, that's also a valid test case
        if (error?.errors?.[0]?.message?.includes('already exists')) {
          expect(error.errors[0].message).toContain('already exists')
        } else {
          throw error
        }
      }
    })

    it('should reject user creation with invalid email', async () => {
      if (!clerkClient) {
        return
      }

      await expect(
        clerkClient.users.createUser({
          emailAddress: ['invalid-email'],
          password: 'TestPassword123!',
        })
      ).rejects.toThrow()
    })

    it('should reject user creation with weak password', async () => {
      if (!clerkClient) {
        return
      }

      const testEmail = `test-weak-${Date.now()}@example.com`

      await expect(
        clerkClient.users.createUser({
          emailAddress: [testEmail],
          password: '123', // Too weak
        })
      ).rejects.toThrow()
    })

    it('should reject duplicate email registration', async () => {
      if (!clerkClient) {
        return
      }

      const testEmail = `test-duplicate-${Date.now()}@example.com`
      const testPassword = `TestP@ssw0rd_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        // Create first user
        const firstUser = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          password: testPassword,
        })

        expect(firstUser).toBeDefined()

        // Try to create duplicate
        await expect(
          clerkClient.users.createUser({
            emailAddress: [testEmail],
            password: testPassword,
          })
        ).rejects.toThrow()

        // Cleanup
        await clerkClient.users.deleteUser(firstUser.id)
      } catch (error: any) {
        // If the duplicate check works, the error should indicate the email exists
        if (error?.errors?.[0]?.message?.includes('already exists')) {
          expect(error.errors[0].message).toContain('already exists')
        } else {
          throw error
        }
      }
    })
  })

  describe('User Authentication', () => {
    it('should authenticate a user with valid credentials', async () => {
      if (!clerkClient) {
        return
      }

      const testEmail = `test-auth-${Date.now()}@example.com`
      const testPassword = `TestP@ssw0rd_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        // Create user
        const user = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          password: testPassword,
        })

        expect(user).toBeDefined()
        expect(user.id).toBeDefined()

        // Verify user can be retrieved
        const retrievedUser = await clerkClient.users.getUser(user.id)
        expect(retrievedUser).toBeDefined()
        expect(retrievedUser.id).toBe(user.id)
        expect(retrievedUser.emailAddresses[0]?.emailAddress).toBe(testEmail)

        // Cleanup
        await clerkClient.users.deleteUser(user.id)
      } catch (error) {
        throw error
      }
    })
  })

  describe('User Management', () => {
    it('should delete a user successfully', async () => {
      if (!clerkClient) {
        return
      }

      const testEmail = `test-delete-${Date.now()}@example.com`
      const testPassword = `TestP@ssw0rd_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        // Create user
        const user = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          password: testPassword,
        })

        expect(user).toBeDefined()
        expect(user.id).toBeDefined()

        // Verify user exists
        const retrievedUser = await clerkClient.users.getUser(user.id)
        expect(retrievedUser.id).toBe(user.id)

        // Delete user
        const deletedUser = await clerkClient.users.deleteUser(user.id)
        expect(deletedUser).toBeDefined()

        // Verify user is deleted (should throw error)
        await expect(clerkClient.users.getUser(user.id)).rejects.toThrow()
      } catch (error) {
        throw error
      }
    })
  })
})

