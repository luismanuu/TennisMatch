/**
 * Rate a completed match that has no live rating yet (admin only). Approving a score already rates the match in the
 * same transaction; this is for a match left unrated. An already rated match is a 409: use admin recalculate.
 */

import { and, eq } from 'drizzle-orm'
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
    
    const liveHistory = await db.query.rating_history.findFirst({
      columns: { id: true },
      where: and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)),
    })

    if (liveHistory) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Match is already rated; use /api/admin/matches/recalculate to rate it again'
      })
    }

    const result = await updateRatingsAfterMatch(matchId)
    
    if (!result) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Match is not ratable (friendly, walkover, or missing players)'
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
