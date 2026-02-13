/**
 * LLM API Integration Test
 * 
 * Tests the actual AI model call to OpenRouter and validates the response.
 * 
 * The test automatically loads OPENROUTER_API_KEY from .env file.
 * To run this test:
 *   npm test tests/llm-api-integration.test.ts
 * 
 * Note: This test requires a valid OPENROUTER_API_KEY in your .env file.
 * If not provided, the test will be skipped.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { calculateEloWithLLM, LLM_MODEL } from '../server/utils/llm-score-resolver'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LlmEloCalculationRequest } from '../server/utils/llm-prompts'

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') })

// MSW is configured in setup.ts to allow OpenRouter API requests to pass through
// No additional configuration needed here

// Mock Supabase client
function createMockSupabaseClient(): SupabaseClient {
  const players = [
    {
      id: 'player1-id',
      name: 'Player One',
      elo: 1200,
      utr_rating: 12.5,
      total_matches_played: 20,
      last_match_at: new Date().toISOString(),
      win_streak: 2,
      loss_streak: 0
    },
    {
      id: 'player2-id',
      name: 'Player Two',
      elo: 1100,
      utr_rating: 11.0,
      total_matches_played: 15,
      last_match_at: new Date().toISOString(),
      win_streak: 0,
      loss_streak: 1
    }
  ]

  // Create a chainable query builder that returns empty data
  const emptyQueryResult = Promise.resolve({ data: [], error: null })
  const createChainableBuilder = () => ({
    eq: () => createChainableBuilder(),
    neq: () => createChainableBuilder(),
    order: () => createChainableBuilder(),
    limit: () => emptyQueryResult
  })

  const mockClient = {
    from: (table: string) => ({
      select: (columns: string) => {
        if (table === 'players') {
          return {
            in: (column: string, values: string[]) => {
              return Promise.resolve({
                data: players.filter(p => values.includes(p.id)),
                error: null
              })
            }
          }
        }
        // For rating_history queries
        return {
          eq: () => createChainableBuilder(),
          or: () => createChainableBuilder()
        }
      }
    })
  }

  return mockClient as unknown as SupabaseClient
}

describe('LLM API Integration', () => {
  const apiKey = process.env.OPENROUTER_API_KEY

  beforeAll(() => {
    if (!apiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in .env file. LLM API tests will be skipped.')
      console.warn('   Add OPENROUTER_API_KEY to your .env file to run these tests.')
    } else {
      console.log('✅ OPENROUTER_API_KEY loaded from .env file')
    }
  })

  describe('Model Configuration', () => {
    it('should use the correct model name', () => {
      expect(LLM_MODEL).toBe('openai/gpt-oss-120b')
    })
  })

  describe('Real API Call', () => {
    it.skipIf(!apiKey)('should successfully call the AI model and get valid response', async () => {
      const mockSupabase = createMockSupabaseClient()
      
      const request: LlmEloCalculationRequest = {
        matchId: 'test-match-id',
        player1Id: 'player1-id',
        player2Id: 'player2-id',
        player1Elo: 1200,
        player2Elo: 1100,
        score: '6-4, 6-3',
        winnerId: 'player1-id'
      }

      const result = await calculateEloWithLLM(
        request,
        mockSupabase,
        { openRouterApiKey: apiKey! }
      )

      // Validate success
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()

      // Validate model name
      expect(result.model).toBe('openai/gpt-oss-120b')

      // Validate response structure
      expect(result).toHaveProperty('player1EloChange')
      expect(result).toHaveProperty('player2EloChange')
      expect(result).toHaveProperty('matchRating')
      expect(result).toHaveProperty('matchWeight')
      expect(result).toHaveProperty('formatDetected')
      expect(result).toHaveProperty('gamesWonP1')
      expect(result).toHaveProperty('gamesLostP1')
      expect(result).toHaveProperty('totalGames')
      expect(result).toHaveProperty('reasoning')

      // Validate data types
      expect(typeof result.player1EloChange).toBe('number')
      expect(typeof result.player2EloChange).toBe('number')
      expect(typeof result.matchRating).toBe('number')
      expect(typeof result.matchWeight).toBe('number')
      expect(typeof result.formatDetected).toBe('string')
      expect(typeof result.gamesWonP1).toBe('number')
      expect(typeof result.gamesLostP1).toBe('number')
      expect(typeof result.totalGames).toBe('number')
      expect(typeof result.reasoning).toBe('string')

      // Validate zero-sum constraint (within ±2 for rounding)
      const sum = result.player1EloChange + result.player2EloChange
      expect(Math.abs(sum)).toBeLessThanOrEqual(2)

      // Validate reasonable ranges
      // ELO changes should be within ±120 points (safety margin)
      expect(Math.abs(result.player1EloChange)).toBeLessThanOrEqual(120)
      expect(Math.abs(result.player2EloChange)).toBeLessThanOrEqual(120)

      // Match rating should be positive and reasonable (0-10000)
      expect(result.matchRating).toBeGreaterThan(0)
      expect(result.matchRating).toBeLessThanOrEqual(10000)

      // Match weight should be between 0 and 2
      expect(result.matchWeight).toBeGreaterThan(0)
      expect(result.matchWeight).toBeLessThanOrEqual(2)

      // Format should be detected
      expect(result.formatDetected).not.toBe('unknown')
      expect(['best-of-3', 'best-of-5', 'pro-set-8', 'pro-set-10', 'super-tiebreak']).toContain(result.formatDetected)

      // Games should match the score
      // Score: '6-4, 6-3' = 12 games won, 7 games lost, 19 total
      expect(result.gamesWonP1).toBe(12)
      expect(result.gamesLostP1).toBe(7)
      expect(result.totalGames).toBe(19)

      // Reasoning should be present and reasonable length
      expect(result.reasoning.length).toBeGreaterThan(0)
      expect(result.reasoning.length).toBeLessThan(5000) // Max length from validation

      // Player 1 won, so should get positive ELO change
      expect(result.player1EloChange).toBeGreaterThan(0)
      expect(result.player2EloChange).toBeLessThan(0)

      console.log('✅ LLM Response validated successfully!')
      console.log(`   Model: ${result.model}`)
      console.log(`   Player 1 ELO Change: ${result.player1EloChange}`)
      console.log(`   Player 2 ELO Change: ${result.player2EloChange}`)
      console.log(`   Match Rating: ${result.matchRating}`)
      console.log(`   Match Weight: ${result.matchWeight}`)
      console.log(`   Format: ${result.formatDetected}`)
      console.log(`   Reasoning length: ${result.reasoning.length} characters`)
    }, 60000) // 60 second timeout for API call

    it.skipIf(!apiKey)('should handle close match scenario correctly', async () => {
      const mockSupabase = createMockSupabaseClient()
      
      const request: LlmEloCalculationRequest = {
        matchId: 'test-match-id-2',
        player1Id: 'player1-id',
        player2Id: 'player2-id',
        player1Elo: 1200, // Close ratings
        player2Elo: 1180,
        score: '7-5, 6-4', // Close match
        winnerId: 'player1-id'
      }

      const result = await calculateEloWithLLM(
        request,
        mockSupabase,
        { openRouterApiKey: apiKey! }
      )

      expect(result.success).toBe(true)
      
      // For close match between close ratings, ELO change should be moderate
      expect(Math.abs(result.player1EloChange)).toBeGreaterThan(10)
      expect(Math.abs(result.player1EloChange)).toBeLessThan(40)

      // Zero-sum should hold
      const sum = result.player1EloChange + result.player2EloChange
      expect(Math.abs(sum)).toBeLessThanOrEqual(2)

      console.log(`✅ Close match test passed: ${result.player1EloChange} / ${result.player2EloChange}`)
    }, 60000)

    it.skipIf(!apiKey)('should handle upset scenario correctly', async () => {
      const mockSupabase = createMockSupabaseClient()
      
      const request: LlmEloCalculationRequest = {
        matchId: 'test-match-id-3',
        player1Id: 'player1-id',
        player2Id: 'player2-id',
        player1Elo: 1000, // Lower rated player
        player2Elo: 1300, // Higher rated player
        score: '6-4, 6-3', // Lower rated wins (upset)
        winnerId: 'player1-id'
      }

      const result = await calculateEloWithLLM(
        request,
        mockSupabase,
        { openRouterApiKey: apiKey! }
      )

      expect(result.success).toBe(true)
      
      // Upset should give higher ELO change to the winner
      expect(result.player1EloChange).toBeGreaterThan(20) // Should be significant
      expect(result.player1EloChange).toBeLessThanOrEqual(120) // But within bounds

      // Match rating should reflect the upset
      expect(result.matchRating).toBeGreaterThan(1000) // Above player's base ELO

      console.log(`✅ Upset test passed: ${result.player1EloChange} (upset bonus)`)
    }, 60000)

    it.skipIf(!apiKey)('should return error if API key is invalid', async () => {
      const mockSupabase = createMockSupabaseClient()
      
      const request: LlmEloCalculationRequest = {
        matchId: 'test-match-id-4',
        player1Id: 'player1-id',
        player2Id: 'player2-id',
        player1Elo: 1200,
        player2Elo: 1100,
        score: '6-4, 6-3',
        winnerId: 'player1-id'
      }

      const result = await calculateEloWithLLM(
        request,
        mockSupabase,
        { openRouterApiKey: 'invalid-key' }
      )

      // Should fail gracefully
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('error') // Error message should contain "error"
    }, 60000)
  })

  describe('Response Quality Checks', () => {
    it.skipIf(!apiKey)('should return reasoning that explains the calculation', async () => {
      const mockSupabase = createMockSupabaseClient()
      
      const request: LlmEloCalculationRequest = {
        matchId: 'test-match-id-5',
        player1Id: 'player1-id',
        player2Id: 'player2-id',
        player1Elo: 1200,
        player2Elo: 1100,
        score: '6-4, 6-3',
        winnerId: 'player1-id'
      }

      const result = await calculateEloWithLLM(
        request,
        mockSupabase,
        { openRouterApiKey: apiKey! }
      )

      expect(result.success).toBe(true)
      
      // Reasoning should be meaningful (not just empty or placeholder)
      expect(result.reasoning.length).toBeGreaterThan(20) // At least a sentence
      
      // Should mention relevant factors (ELO, score, match weight, etc.)
      const reasoningLower = result.reasoning.toLowerCase()
      const hasRelevantContent = 
        reasoningLower.includes('elo') ||
        reasoningLower.includes('rating') ||
        reasoningLower.includes('match') ||
        reasoningLower.includes('score') ||
        reasoningLower.includes('weight') ||
        reasoningLower.includes('player')
      
      expect(hasRelevantContent).toBe(true)
      
      console.log(`✅ Reasoning quality check passed`)
      console.log(`   Reasoning preview: ${result.reasoning.substring(0, 100)}...`)
    }, 60000)
  })
})
