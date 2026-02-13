/**
 * LLM Score Resolver
 * Uses OpenRouter API to calculate ELO changes using LLM analysis
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchFormat } from './utr-rating-system'
import type { LlmEloCalculationRequest } from './llm-prompts'
import { logger } from './logger'

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
// Using OpenAI GPT-OSS 120B via OpenRouter
export const LLM_MODEL = 'openai/gpt-oss-120b'
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

    type PlayerRow = {
      id: string
      name: string
      elo: number | null
      utr_rating: number | null
      total_matches_played: number | null
      last_match_at: string | null
      win_streak: number | null
      loss_streak: number | null
    }
    const typedPlayers = players as unknown as PlayerRow[]
    const player1 = typedPlayers.find(p => p.id === request.player1Id)!
    const player2 = typedPlayers.find(p => p.id === request.player2Id)!
    
    // Fetch recent matches and head-to-head in parallel for better performance
    // Reduced to 5 matches per player to improve API response time
    // IMPORTANT: Exclude reversed ratings and the current match being processed
    const [player1MatchesResult, player2MatchesResult, headToHeadResult] = await Promise.all([
      supabase
        .from('rating_history')
        .select(`
          match_id,
          score:matches(score),
          was_winner,
          opponent:players!rating_history_opponent_id_fkey(id, name),
          created_at
        `)
        .eq('player_id', request.player1Id)
        .eq('rating_reversed', false)
        .neq('match_id', request.matchId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rating_history')
        .select(`
          match_id,
          score:matches(score),
          was_winner,
          opponent:players!rating_history_opponent_id_fkey(id, name),
          created_at
        `)
        .eq('player_id', request.player2Id)
        .eq('rating_reversed', false)
        .neq('match_id', request.matchId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rating_history')
        .select(`
          match_id,
          score:matches(score),
          was_winner,
          created_at
        `)
        .or(`and(player_id.eq.${request.player1Id},opponent_id.eq.${request.player2Id}),and(player_id.eq.${request.player2Id},opponent_id.eq.${request.player1Id})`)
        .eq('rating_reversed', false)
        .neq('match_id', request.matchId)
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
      player2.total_matches_played ?? 0,
      player2.last_match_at
    )
    const finalMatchWeight = formatWeight * competitivenessWeight * reliabilityWeight
    
    // Build context
    const context = buildMatchContext(
      request,
      {
        ...player1,
        recentMatches: (player1Matches as unknown as Array<Record<string, unknown>>) || [],
        headToHead:
          (headToHead as unknown as Array<{ was_winner?: boolean | null }>)?.filter(h => h.was_winner !== undefined) || []
      },
      { ...player2, recentMatches: (player2Matches as unknown as Array<Record<string, unknown>>) || [], headToHead: [] },
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
  } catch (error: unknown) {
    const err = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null
    const message = err && typeof err['message'] === 'string' ? (err['message'] as string) : 'Unknown error'
    logger.error('LLM ELO calculation failed', error, { matchId: request.matchId })
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
      error: message
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
): Promise<string> {
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
            content: 'You are an expert tennis rating system analyst. Always return valid JSON responses. Keep reasoning concise (max 500 words).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more deterministic results
        response_format: { type: 'json_object' }, // Request JSON response
        max_tokens: 2000 // Limit response tokens to prevent excessive reasoning length
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData: unknown = null
      
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Not JSON, use text as is
      }
      
      // Handle rate limiting (429) with longer backoff
      if (response.status === 429) {
        const err = typeof errorData === 'object' && errorData !== null ? (errorData as Record<string, unknown>) : null
        const errError = err && typeof err['error'] === 'object' && err['error'] !== null ? (err['error'] as Record<string, unknown>) : null
        const errMetadata =
          errError && typeof errError['metadata'] === 'object' && errError['metadata'] !== null
            ? (errError['metadata'] as Record<string, unknown>)
            : null
        const raw = typeof errMetadata?.['raw'] === 'string' ? (errMetadata['raw'] as string) : null
        const isRateLimited =
          (raw ? raw.includes('rate-limited') : false) || errorText.includes('rate-limited') || errorText.includes('429')
        
        if (isRateLimited && retryCount < MAX_RETRIES) {
          // Longer delay for rate limiting: 5s, 15s, 30s
          const delay = retryCount === 0 ? 5000 : retryCount === 1 ? 15000 : 30000
          logger.warn('LLM rate limited, retrying', { delay, attempt: retryCount + 1, maxRetries: MAX_RETRIES + 1 })
          await new Promise(resolve => setTimeout(resolve, delay))
          return callOpenRouterAPI(prompt, apiKey, retryCount + 1)
        }
        
        // If still rate limited after retries, throw with helpful message
        throw new Error(`OpenRouter API rate limited. The free model is temporarily unavailable. Please retry later or configure your own API key: ${errorText}`)
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }
    
    const data = (await response.json()) as unknown
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    const choices = obj && Array.isArray(obj['choices']) ? (obj['choices'] as Array<Record<string, unknown>>) : null
    const first = choices && choices[0] ? choices[0] : null
    const messageObj = first && typeof first['message'] === 'object' && first['message'] !== null ? (first['message'] as Record<string, unknown>) : null
    const content = messageObj && typeof messageObj['content'] === 'string' ? (messageObj['content'] as string) : null
    
    if (!content) {
      throw new Error('Invalid response format from OpenRouter API')
    }
    
    return content
  } catch (error: unknown) {
    const err = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null
    if (err && err['name'] === 'AbortError') {
      throw new Error('LLM API timeout')
    }
    
    // If error already handled (rate limiting with retries exhausted), re-throw
    const message = err && typeof err['message'] === 'string' ? (err['message'] as string) : null
    if (message?.includes('rate limited')) {
      throw error
    }
    
    // Retry with exponential backoff for other errors
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
      logger.warn('LLM API error, retrying', { delay, attempt: retryCount + 1, maxRetries: MAX_RETRIES + 1, error: message })
      await new Promise(resolve => setTimeout(resolve, delay))
      return callOpenRouterAPI(prompt, apiKey, retryCount + 1)
    }
    
    throw error
  }
}

/**
 * Sanitize JSON string by removing/escaping control characters
 */
function sanitizeJsonString(jsonText: string): string {
  // Process the JSON string character by character to properly escape control characters in string values
  let result = ''
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    if (!char) continue
    const code = char.charCodeAt(0)
    
    if (escapeNext) {
      // Previous character was a backslash, so this is an escaped character
      result += char
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      result += char
      continue
    }
    
    if (char === '"' && (i === 0 || jsonText[i - 1] !== '\\')) {
      // Toggle string state (handle escaped quotes)
      inString = !inString
      result += char
      continue
    }
    
    if (inString) {
      // Inside a string value - escape control characters
      if (code >= 0x00 && code <= 0x1F) {
        // Control character - escape it
        const escapes: Record<number, string> = {
          0x08: '\\b',  // backspace
          0x09: '\\t',  // tab
          0x0A: '\\n',  // newline
          0x0C: '\\f',  // form feed
          0x0D: '\\r',  // carriage return
        }
        result += escapes[code] || `\\u${code.toString(16).padStart(4, '0')}`
      } else if (code === 0x7F) {
        // DEL character
        result += '\\u007f'
      } else {
        result += char
      }
    } else {
      // Outside string - keep as is (but remove control chars that shouldn't be there)
      if (code >= 0x00 && code <= 0x1F && code !== 0x09 && code !== 0x0A && code !== 0x0D) {
        // Skip control characters outside strings (except whitespace)
        continue
      }
      result += char
    }
  }
  
  return result
}

/**
 * Repair JSON with unterminated strings and other common issues
 */
function repairJsonString(jsonText: string): string {
  let result = ''
  let inString = false
  let escapeNext = false
  let braceDepth = 0
  let bracketDepth = 0
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    if (!char) continue
    
    if (escapeNext) {
      result += char
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      result += char
      continue
    }
    
    if (char === '"' && (i === 0 || jsonText[i - 1] !== '\\')) {
      inString = !inString
      result += char
      continue
    }
    
    if (inString) {
      // Inside string - keep everything as is
      result += char
    } else {
      // Outside string - handle structure
      if (char === '{') {
        braceDepth++
        result += char
      } else if (char === '}') {
        if (braceDepth > 0) braceDepth--
        result += char
      } else if (char === '[') {
        bracketDepth++
        result += char
      } else if (char === ']') {
        if (bracketDepth > 0) bracketDepth--
        result += char
      } else {
        result += char
      }
    }
  }
  
  // Close any unterminated strings
  if (inString) {
    result += '"'
  }
  
  // Close any unclosed braces/brackets
  while (braceDepth > 0) {
    result += '}'
    braceDepth--
  }
  while (bracketDepth > 0) {
    result += ']'
    bracketDepth--
  }
  
  return result
}

/**
 * Extract JSON object from text, handling truncation
 */
function extractJsonObject(text: string): string {
  // First, try to find JSON in markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?)\s*```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1]
  }
  
  // Find the first { and try to find matching }
  const firstBrace = text.indexOf('{')
  if (firstBrace === -1) {
    return text
  }
  
  let braceCount = 0
  let inString = false
  let escapeNext = false
  let lastValidBrace = firstBrace
  
  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"' && (i === 0 || text[i - 1] !== '\\')) {
      inString = !inString
      continue
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++
        lastValidBrace = i
      } else if (char === '}') {
        braceCount--
        lastValidBrace = i
        if (braceCount === 0) {
          // Found complete object
          return text.substring(firstBrace, i + 1)
        }
      }
    }
  }
  
  // If we didn't find a complete object, return what we have and close it
  const extracted = text.substring(firstBrace, lastValidBrace + 1)
  // Close any unclosed braces
  while (braceCount > 0) {
    return extracted + '}'.repeat(braceCount)
  }
  
  return extracted || text
}

/**
 * Parse LLM JSON response with aggressive error recovery
 */
function parseLLMResponse(responseText: string): LlmEloCalculationResponse {
  try {
    // Step 1: Extract JSON from text
    let jsonText = responseText.trim()
    jsonText = extractJsonObject(jsonText)
    
    // Step 2: Try direct parse
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseError: unknown) {
      // Step 3: Sanitize control characters
      const perr = typeof parseError === 'object' && parseError !== null ? (parseError as Record<string, unknown>) : null
      logger.debug('Initial JSON parse failed, attempting to sanitize', { error: perr && typeof perr['message'] === 'string' ? (perr['message'] as string) : undefined })
      let sanitized = sanitizeJsonString(jsonText)
      
      try {
        parsed = JSON.parse(sanitized)
      } catch (sanitizeError: unknown) {
        // Step 4: Repair unterminated strings and structures
        const serr = typeof sanitizeError === 'object' && sanitizeError !== null ? (sanitizeError as Record<string, unknown>) : null
        logger.debug('Sanitized parse failed, attempting to repair JSON', { error: serr && typeof serr['message'] === 'string' ? (serr['message'] as string) : undefined })
        let repaired = repairJsonString(sanitized)
        
        try {
          parsed = JSON.parse(repaired)
        } catch (repairError: unknown) {
          // Step 5: Try to extract just the first complete JSON object
          const firstBrace = repaired.indexOf('{')
          const lastBrace = repaired.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const extracted = repaired.substring(firstBrace, lastBrace + 1)
            try {
              parsed = JSON.parse(extracted)
            } catch (extractError: unknown) {
              // Step 6: Last resort - try to extract values using regex as fallback
              const eerr = typeof extractError === 'object' && extractError !== null ? (extractError as Record<string, unknown>) : null
              logger.warn('All parsing attempts failed, using regex extraction as fallback', { error: eerr && typeof eerr['message'] === 'string' ? (eerr['message'] as string) : undefined })
              parsed = extractJsonValuesWithRegex(repaired)
            }
          } else {
            // Step 6: Last resort - regex extraction
            parsed = extractJsonValuesWithRegex(repaired)
          }
        }
      }
    }
    
    const pobj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
    // Return with safe defaults
    const formatString = String(pobj['format_detected'] || 'unknown').substring(0, 50)
    return {
      player1_elo_change: parseFloat(String(pobj['player1_elo_change'] ?? '')) || 0,
      player2_elo_change: parseFloat(String(pobj['player2_elo_change'] ?? '')) || 0,
      match_rating: parseFloat(String(pobj['match_rating'] ?? '')) || 0,
      match_weight: parseFloat(String(pobj['match_weight'] ?? '')) || 1.0,
      format_detected: formatString as MatchFormat,
      games_won_p1: parseInt(String(pobj['games_won_p1'] ?? '')) || 0,
      games_lost_p1: parseInt(String(pobj['games_lost_p1'] ?? '')) || 0,
      total_games: parseInt(String(pobj['total_games'] ?? '')) || 0,
      reasoning: String(pobj['reasoning'] || '').substring(0, 5000) // Limit reasoning length
    }
  } catch (error: unknown) {
    // Ultimate fallback - return safe defaults
    logger.error('Complete parse failure, using defaults', error)
    return {
      player1_elo_change: 0,
      player2_elo_change: 0,
      match_rating: 0,
      match_weight: 1.0,
      format_detected: 'unknown',
      games_won_p1: 0,
      games_lost_p1: 0,
      total_games: 0,
      reasoning: 'JSON parsing failed, using default values'
    }
  }
}

/**
 * Extract JSON values using regex as last resort
 */
function extractJsonValuesWithRegex(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  
  // Extract numeric values
  const numericPatterns = {
    player1_elo_change: /"player1_elo_change"\s*:\s*(-?\d+\.?\d*)/i,
    player2_elo_change: /"player2_elo_change"\s*:\s*(-?\d+\.?\d*)/i,
    match_rating: /"match_rating"\s*:\s*(-?\d+\.?\d*)/i,
    match_weight: /"match_weight"\s*:\s*(-?\d+\.?\d*)/i,
    games_won_p1: /"games_won_p1"\s*:\s*(\d+)/i,
    games_lost_p1: /"games_lost_p1"\s*:\s*(\d+)/i,
    total_games: /"total_games"\s*:\s*(\d+)/i
  }
  
  for (const [key, pattern] of Object.entries(numericPatterns)) {
    const match = text.match(pattern)
    if (match && match[1]) {
      result[key] = parseFloat(match[1]) || 0
    }
  }
  
  // Extract string values
  const stringPatterns = {
    format_detected: /"format_detected"\s*:\s*"([^"]*?)"/i,
    reasoning: /"reasoning"\s*:\s*"([^"]*?)"/i
  }
  
  for (const [key, pattern] of Object.entries(stringPatterns)) {
    const match = text.match(pattern)
    if (match && match[1]) {
      result[key] = match[1]
    }
  }
  
  // For reasoning, try to extract even if unterminated
  const reasoningMatch = text.match(/"reasoning"\s*:\s*"([^"]*)/i)
  if (reasoningMatch && reasoningMatch[1] && !result.reasoning) {
    // Extract everything after "reasoning": " until end or next quote
    const start = text.indexOf('"reasoning"', reasoningMatch.index || 0)
    if (start !== -1) {
      const valueStart = text.indexOf('"', start + 11) + 1
      if (valueStart > 0) {
        // Extract until end of text or next unescaped quote
        let value = ''
        for (let i = valueStart; i < text.length; i++) {
          if (text[i] === '"' && text[i - 1] !== '\\') {
            break
          }
          value += text[i]
        }
        result.reasoning = value.substring(0, 5000)
      }
    }
  }
  
  return result
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
    logger.warn('LLM response violated zero-sum, enforcing zero-sum', { sum, player1_elo_change: response.player1_elo_change })
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
    logger.warn('Games count mismatch, recalculating from score', {
      games_won_p1: response.games_won_p1,
      games_lost_p1: response.games_lost_p1,
      total_games: response.total_games
    })
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
