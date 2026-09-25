import { and, asc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, players, rating_history } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const matchId = getRouterParam(event, 'id')
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    const db = useDb()
    
    // Admins can act on any match
    const isAdmin = user.role === 'admin'
    
    // Get current player
    const currentPlayer = await db.query.players.findFirst({
      columns: { id: true },
      where: eq(players.user_id, user.id),
    })
    
    if (!currentPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Player not found'
      })
    }
    
    // Get match to verify user is involved
    const match = await db.query.matches.findFirst({
      columns: { id: true, player1_id: true, player2_id: true, status: true, is_competitive: true },
      where: eq(matches.id, matchId),
    })
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Verify user is involved in the match OR is admin
    if (!isAdmin && match.player1_id !== currentPlayer.id && match.player2_id !== currentPlayer.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only view rating history for matches you participated in'
      })
    }
    
    // Only return rating history for competitive matches
    if (!match.is_competitive || match.status !== 'completed') {
      return {
        success: true,
        rating_history: null
      }
    }
    
    // Rating history for both players for this match (only non-reversed entries).
    // None yet (not calculated, or a recalculation in progress) returns null so the page keeps showing "Calculando ELO...".
    const ratingHistory = await db
      .select({
        player_id: rating_history.player_id,
        elo_before: rating_history.elo_before,
        elo_after: rating_history.elo_after,
        elo_change: rating_history.elo_change,
      })
      .from(rating_history)
      .where(and(eq(rating_history.match_id, matchId), eq(rating_history.rating_reversed, false)))
      .orderBy(asc(rating_history.created_at))
    
    if (ratingHistory.length === 0) {
      return {
        success: true,
        rating_history: null
      }
    }
    
    const player1History = ratingHistory.find(h => h.player_id === match.player1_id)
    const player2History = ratingHistory.find(h => h.player_id === match.player2_id)
    
    // A missing side returns null for that player (partial data is still returned)
    return {
      success: true,
      rating_history: {
        player1: player1History ? {
          elo_change: player1History.elo_change,
          elo_before: player1History.elo_before,
          elo_after: player1History.elo_after
        } : null,
        player2: player2History ? {
          elo_change: player2History.elo_change,
          elo_before: player2History.elo_before,
          elo_after: player2History.elo_after
        } : null
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
