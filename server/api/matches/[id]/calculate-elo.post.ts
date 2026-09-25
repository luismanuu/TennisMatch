/**
 * API Endpoint for LLM-based ELO Calculation
 * This endpoint can be called manually, but it's also automatically triggered
 * when a match is completed (both players accepted score)
 * Admin only: it rewrites ratings and spends LLM credits.
 */

import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, rating_history } from '~/server/db/schema'
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
    
    const db = useDb()
    
    // Check if match exists and is completed
    const match = await db.query.matches.findFirst({
      columns: { id: true, status: true, winner_id: true, player1_id: true, player2_id: true, score: true },
      where: eq(matches.id, matchId),
    })
    
    if (!match) {
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
    const existingHistory = await db.query.rating_history.findFirst({
      columns: { id: true },
      where: eq(rating_history.match_id, matchId),
    })
    
    if (existingHistory) {
      // ELO already calculated, recalculate (this will update UTR if needed)
      const result = await updateRatingsAfterMatch(matchId)
      
      return {
        success: true,
        recalculated: true,
        message: 'ELO recalculated successfully',
        result
      }
    }
    
    // Calculate ELO (this will trigger LLM if API key is available)
    const result = await updateRatingsAfterMatch(matchId)
    
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
