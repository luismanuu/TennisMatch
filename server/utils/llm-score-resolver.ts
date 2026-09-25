/**
 * LLM Score Resolver
 * Uses OpenRouter API to calculate ELO changes using LLM analysis
 */

import { and, desc, eq, inArray, ne, or } from 'drizzle-orm'
import { useDb, type DbOrTx } from '../db'
import { players, rating_history } from '../db/schema'
import type { MatchFormat } from './utr-rating-system'
import type { LlmEloCalculationRequest, LlmHistoryEntry } from './llm-prompts'

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
  config: { openRouterApiKey: string },
  tx?: DbOrTx
): Promise<LlmEloCalculationResult> {
  try {
    const db = tx ?? useDb()
    // Fetch player data (including win streaks)
    const playerRows = await db
      .select({
        id: players.id,
        name: players.name,
        elo: players.elo,
        utr_rating: players.utr_rating,
        total_matches_played: players.total_matches_played,
        last_match_at: players.last_match_at,
        win_streak: players.win_streak,
        loss_streak: players.loss_streak,
      })
      .from(players)
      .where(inArray(players.id, [request.player1Id, request.player2Id]))

    const row1 = playerRows.find(p => p.id === request.player1Id)
    const row2 = playerRows.find(p => p.id === request.player2Id)
    if (!row1 || !row2) {
      throw new Error('Failed to fetch players')
    }
    const player1 = { ...row1, ...request.playerStates?.[row1.id] }
    const player2 = { ...row2, ...request.playerStates?.[row2.id] }

    // Recent matches (5 per player) and head-to-head, excluding reversed ratings and the match being processed
    const live = and(eq(rating_history.rating_reversed, false), ne(rating_history.match_id, request.matchId))
    const recent = (playerId: string) =>
      db.query.rating_history.findMany({
        columns: { match_id: true, was_winner: true, created_at: true },
        with: { match: { columns: { score: true } }, opponent: { columns: { id: true, name: true } } },
        where: and(eq(rating_history.player_id, playerId), live),
        orderBy: [desc(rating_history.created_at)],
        limit: 5,
      })
    const [player1Matches, player2Matches, headToHead] = await Promise.all([
      recent(request.player1Id),
      recent(request.player2Id),
      db.query.rating_history.findMany({
        columns: { match_id: true, was_winner: true, created_at: true },
        with: { match: { columns: { score: true } } },
        where: and(
          or(
            and(eq(rating_history.player_id, request.player1Id), eq(rating_history.opponent_id, request.player2Id)),
            and(eq(rating_history.player_id, request.player2Id), eq(rating_history.opponent_id, request.player1Id))
          ),
          live
        ),
        orderBy: [desc(rating_history.created_at)],
        limit: 5,
      }),
    ])
    const toHistory = (rows: Array<{ was_winner: boolean; created_at: Date | null; match: { score: string | null } | null; opponent?: { name: string } | null }>): LlmHistoryEntry[] =>
      rows.map(r => ({ score: r.match?.score ?? null, was_winner: r.was_winner, created_at: r.created_at, opponent: r.opponent ?? null }))
    
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
      { ...player1, recentMatches: toHistory(player1Matches), headToHead: toHistory(headToHead) },
      { ...player2, recentMatches: toHistory(player2Matches), headToHead: [] },
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
    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseError: any) {
      // Step 3: Sanitize control characters
      console.warn('[LLM] Initial JSON parse failed, attempting to sanitize...')
      let sanitized = sanitizeJsonString(jsonText)
      
      try {
        parsed = JSON.parse(sanitized)
      } catch (sanitizeError: any) {
        // Step 4: Repair unterminated strings and structures
        console.warn('[LLM] Sanitized parse failed, attempting to repair JSON...')
        let repaired = repairJsonString(sanitized)
        
        try {
          parsed = JSON.parse(repaired)
        } catch (repairError: any) {
          // Step 5: Try to extract just the first complete JSON object
          const firstBrace = repaired.indexOf('{')
          const lastBrace = repaired.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const extracted = repaired.substring(firstBrace, lastBrace + 1)
            try {
              parsed = JSON.parse(extracted)
            } catch (extractError: any) {
              // Step 6: Last resort - try to extract values using regex as fallback
              console.warn('[LLM] All parsing attempts failed, using regex extraction as fallback...')
              parsed = extractJsonValuesWithRegex(repaired)
            }
          } else {
            // Step 6: Last resort - regex extraction
            parsed = extractJsonValuesWithRegex(repaired)
          }
        }
      }
    }
    
    // Return with safe defaults
    return {
      player1_elo_change: parseFloat(parsed.player1_elo_change) || 0,
      player2_elo_change: parseFloat(parsed.player2_elo_change) || 0,
      match_rating: parseFloat(parsed.match_rating) || 0,
      match_weight: parseFloat(parsed.match_weight) || 1.0,
      format_detected: toMatchFormat(parsed.format_detected),
      games_won_p1: parseInt(parsed.games_won_p1) || 0,
      games_lost_p1: parseInt(parsed.games_lost_p1) || 0,
      total_games: parseInt(parsed.total_games) || 0,
      reasoning: String(parsed.reasoning || '').substring(0, 5000) // Limit reasoning length
    }
  } catch (error: any) {
    // Ultimate fallback - return safe defaults
    console.error('[LLM] Complete parse failure, using defaults:', error.message)
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

const MATCH_FORMATS: readonly MatchFormat[] = ['best-of-3', 'best-of-5', 'pro-set-8', 'pro-set-10', 'super-tiebreak', 'walkover', 'unknown']

function toMatchFormat(value: unknown): MatchFormat {
  return MATCH_FORMATS.find(f => f === value) ?? 'unknown'
}

/**
 * Extract JSON values using regex as last resort
 */
function extractJsonValuesWithRegex(text: string): any {
  const result: any = {}
  
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
