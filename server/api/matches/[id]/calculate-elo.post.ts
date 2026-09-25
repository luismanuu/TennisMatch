/**
 * API Endpoint for LLM-based ELO Calculation
 * This endpoint can be called manually, but it's also automatically triggered
 * when a match is completed (both players accepted score)
 * Admin only: it rewrites ratings and spends LLM credits.
 */

import { getSupabaseAdmin } from '~/server/utils/supabase'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const matchId = getRouterParam(event, 'id')
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Check if match exists and is completed
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, winner_id, player1_id, player2_id, score')
      .eq('id', matchId)
      .single()
    
    if (matchError || !match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    if (match.status !== 'completed') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match must be completed to calculate ELO'
      })
    }
    
    if (!match.winner_id || !match.player1_id || !match.player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match must have both players and a winner'
      })
    }
    
    // Check if ELO has already been calculated
    const { data: existingHistory } = await supabase
      .from('rating_history')
      .select('id')
      .eq('match_id', matchId)
      .limit(1)
    
    if (existingHistory && existingHistory.length > 0) {
      // ELO already calculated, recalculate (this will update UTR if needed)
      const result = await updateRatingsAfterMatch(matchId, supabase)
      
      return {
        success: true,
        recalculated: true,
        message: 'ELO recalculated successfully',
        result
      }
    }
    
    // Calculate ELO (this will trigger LLM if API key is available)
    const result = await updateRatingsAfterMatch(matchId, supabase)
    
    if (!result) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to calculate ELO'
      })
    }
    
    return {
      success: true,
      recalculated: false,
      message: 'ELO calculated successfully',
      result
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
