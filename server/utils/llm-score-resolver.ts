/**
 * LLM Score Resolver
 * Uses OpenRouter API to calculate ELO changes using LLM analysis
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchFormat } from './utr-rating-system'
import type { LlmEloCalculationRequest } from './llm-prompts'

export interface LlmEloCalculationResponse {
  player1_elo_change: number
  player2_elo_change: number
  match_rating: number
  match_weight: number
  format_detected: MatchFormat
  games_won_p1: number
  games_lost_p1: number
  total_games: number
  reasoning: string
}
import { 
  detectMatchFormatFromScore,
  parseGamesFromScore,
  calculateMatchWeight,
  getFormatWeight,
  getCompetitivenessWeight,
  getReliabilityWeight
} from './utr-rating-system'
import { buildMatchContext, getEloCalculationPrompt } from './llm-prompts'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Using Google Gemini 2.5 Flash via OpenRouter
const LLM_MODEL = 'google/gemini-2.5-flash'
const LLM_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 2

export interface LlmEloCalculationResult {
  success: boolean
  player1EloChange: number
  player2EloChange: number
  matchRating: number
  matchWeight: number
  formatDetected: MatchFormat
  gamesWonP1: number
  gamesLostP1: number
  totalGames: number
  reasoning: string
  model?: string
  error?: string
}

/**
 * Calculate ELO changes using LLM
 */
export async function calculateEloWithLLM(
  request: LlmEloCalculationRequest,
  supabase: SupabaseClient,
  config: { openRouterApiKey: string }
): Promise<LlmEloCalculationResult> {
  try {
    // Fetch player data with recent matches (including win streaks)
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        utr_rating,
        total_matches_played,
        last_match_at,
        win_streak,
        loss_streak
      `)
      .in('id', [request.player1Id, request.player2Id])
    
    if (playersError || !players || players.length !== 2) {
      throw new Error('Failed to fetch players')
    }
    
    const player1 = players.find(p => p.id === request.player1Id)!
    const player2 = players.find(p => p.id === request.player2Id)!
    
    // Fetch recent matches and head-to-head in parallel for better performance
    // Reduced to 5 matches per player to improve API response time
    const [player1MatchesResult, player2MatchesResult, headToHeadResult] = await Promise.all([
      supabase
        .from('rating_history')
        .select(`
          score:matches(score),
          was_winner,
          opponent:players!rating_history_opponent_id_fkey(id, name),
          created_at
        `)
        .eq('player_id', request.player1Id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rating_history')
        .select(`
          score:matches(score),
          was_winner,
          opponent:players!rating_history_opponent_id_fkey(id, name),
          created_at
        `)
        .eq('player_id', request.player2Id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rating_history')
        .select(`
          score:matches(score),
          was_winner,
          created_at
        `)
        .or(`and(player_id.eq.${request.player1Id},opponent_id.eq.${request.player2Id}),and(player_id.eq.${request.player2Id},opponent_id.eq.${request.player1Id})`)
        .order('created_at', { ascending: false })
        .limit(5)
    ])
    
    const player1Matches = player1MatchesResult.data
    const player2Matches = player2MatchesResult.data
    const headToHead = headToHeadResult.data
    
    // Detect format and calculate match weight factors
    const formatDetected = detectMatchFormatFromScore(request.score)
    const formatWeight = getFormatWeight(formatDetected)
    const eloDifference = Math.abs(request.player1Elo - request.player2Elo)
    const competitivenessWeight = getCompetitivenessWeight(eloDifference)
    const reliabilityWeight = getReliabilityWeight(
      player2.total_matches_played,
      player2.last_match_at
    )
    const finalMatchWeight = formatWeight * competitivenessWeight * reliabilityWeight
    
    // Build context
    const context = buildMatchContext(
      request,
      { ...player1, recentMatches: player1Matches || [], headToHead: headToHead?.filter(h => h.was_winner !== undefined) || [] },
      { ...player2, recentMatches: player2Matches || [], headToHead: [] },
      {
        formatWeight,
        competitivenessWeight,
        reliabilityWeight,
        finalWeight: finalMatchWeight
      },
      formatDetected
    )
    
    // Get prompt
    const prompt = getEloCalculationPrompt(context)
    
    // Call OpenRouter API
    const response = await callOpenRouterAPI(prompt, config.openRouterApiKey)
    
    // Parse and validate response
    const parsed = parseLLMResponse(response)
    const validated = validateLLMResponse(parsed, request)
    
    // Parse games from score
    const gamesData = parseGamesFromScore(request.score, 1)
    
    return {
      success: true,
      player1EloChange: validated.player1_elo_change,
      player2EloChange: validated.player2_elo_change,
      matchRating: validated.match_rating,
      matchWeight: validated.match_weight,
      formatDetected: validated.format_detected,
      gamesWonP1: gamesData.gamesWon,
      gamesLostP1: gamesData.gamesLost,
      totalGames: gamesData.totalGames,
      reasoning: validated.reasoning,
      model: LLM_MODEL
    }
  } catch (error: any) {
    console.error('LLM ELO calculation failed:', error)
    return {
      success: false,
      player1EloChange: 0,
      player2EloChange: 0,
      matchRating: 0,
      matchWeight: 0,
      formatDetected: 'unknown',
      gamesWonP1: 0,
      gamesLostP1: 0,
      totalGames: 0,
      reasoning: '',
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Call OpenRouter API with retry logic
 */
async function callOpenRouterAPI(
  prompt: string,
  apiKey: string,
  retryCount = 0
): Promise<any> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT)
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://tennismatch.app', // Optional: for OpenRouter analytics
        'X-Title': 'Tennis Match Rating System' // Optional: for OpenRouter analytics
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert tennis rating system analyst. Always return valid JSON responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more deterministic results
        response_format: { type: 'json_object' } // Request JSON response
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = null
      
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Not JSON, use text as is
      }
      
      // Handle rate limiting (429) with longer backoff
      if (response.status === 429) {
        const isRateLimited = errorData?.error?.metadata?.raw?.includes('rate-limited') || 
                              errorText.includes('rate-limited') ||
                              errorText.includes('429')
        
        if (isRateLimited && retryCount < MAX_RETRIES) {
          // Longer delay for rate limiting: 5s, 15s, 30s
          const delay = retryCount === 0 ? 5000 : retryCount === 1 ? 15000 : 30000
          console.warn(`[LLM] Rate limited, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return callOpenRouterAPI(prompt, apiKey, retryCount + 1)
        }
        
        // If still rate limited after retries, throw with helpful message
        throw new Error(`OpenRouter API rate limited. The free model is temporarily unavailable. Please retry later or configure your own API key: ${errorText}`)
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter API')
    }
    
    return data.choices[0].message.content
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('LLM API timeout')
    }
    
    // If error already handled (rate limiting with retries exhausted), re-throw
    if (error.message?.includes('rate limited')) {
      throw error
    }
    
    // Retry with exponential backoff for other errors
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
      console.warn(`[LLM] API error, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message)
      await new Promise(resolve => setTimeout(resolve, delay))
      return callOpenRouterAPI(prompt, apiKey, retryCount + 1)
    }
    
    throw error
  }
}

/**
 * Parse LLM JSON response
 */
function parseLLMResponse(responseText: string): LlmEloCalculationResponse {
  try {
    // Try to extract JSON from markdown code blocks if present
    let jsonText = responseText.trim()
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }
    
    const parsed = JSON.parse(jsonText)
    
    return {
      player1_elo_change: parsed.player1_elo_change ?? 0,
      player2_elo_change: parsed.player2_elo_change ?? 0,
      match_rating: parsed.match_rating ?? 0,
      match_weight: parsed.match_weight ?? 1.0,
      format_detected: parsed.format_detected ?? 'unknown',
      games_won_p1: parsed.games_won_p1 ?? 0,
      games_lost_p1: parsed.games_lost_p1 ?? 0,
      total_games: parsed.total_games ?? 0,
      reasoning: parsed.reasoning ?? ''
    }
  } catch (error) {
    throw new Error(`Failed to parse LLM response: ${error}`)
  }
}

/**
 * Validate LLM response
 */
function validateLLMResponse(
  response: LlmEloCalculationResponse,
  request: LlmEloCalculationRequest
): LlmEloCalculationResponse {
  // Zero-sum validation (critical for ELO)
  const sum = response.player1_elo_change + response.player2_elo_change
  if (Math.abs(sum) > 2) {
    // Recalculate to enforce zero-sum
    console.warn(`LLM response violated zero-sum (sum=${sum}), enforcing zero-sum`)
    response.player2_elo_change = -response.player1_elo_change
  }
  
  // Validate ELO changes are reasonable (within ±120 points to accommodate higher K-factors and match weights)
  // With K-factor of 40 and high match weight, theoretical max is ~50 base + 8 streak bonus = ~58 points
  // Setting limit to 120 provides safety margin for edge cases
  if (Math.abs(response.player1_elo_change) > 120) {
    throw new Error(`ELO change out of bounds: ${response.player1_elo_change}`)
  }
  
  // Validate match rating is reasonable
  if (response.match_rating < 0 || response.match_rating > 10000) {
    throw new Error(`Match rating out of bounds: ${response.match_rating}`)
  }
  
  // Validate match weight is reasonable
  if (response.match_weight < 0 || response.match_weight > 2) {
    throw new Error(`Match weight out of bounds: ${response.match_weight}`)
  }
  
  // Validate games count
  if (response.games_won_p1 + response.games_lost_p1 !== response.total_games) {
    console.warn(`Games count mismatch: ${response.games_won_p1} + ${response.games_lost_p1} != ${response.total_games}`)
    // Recalculate from score
    const gamesData = parseGamesFromScore(request.score, 1)
    response.games_won_p1 = gamesData.gamesWon
    response.games_lost_p1 = gamesData.gamesLost
    response.total_games = gamesData.totalGames
  }
  
  return response
}

/**
 * Get default ELO calculation (fallback when LLM fails)
 */
export function getDefaultEloCalculation(
  player1Elo: number,
  player2Elo: number,
  winnerId: string,
  player1Id: string
): { player1EloChange: number; player2EloChange: number } {
  // Use standard ELO formula with K=32
  const K = 32
  const expected1 = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400))
  const actual1 = winnerId === player1Id ? 1 : 0
  
  const player1Change = Math.round(K * (actual1 - expected1))
  const player2Change = -player1Change // Zero-sum
  
  return {
    player1EloChange: player1Change,
    player2EloChange: player2Change
  }
}
