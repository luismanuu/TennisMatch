import { and, asc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, players, rating_history } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { classifyStoredScore, isRatable, parseExplanation } from '~/server/utils/elo'

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
      columns: { id: true, player1_id: true, player2_id: true, status: true, is_competitive: true, score: true },
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
    
    // A walkover is completed but never rated: say so, so the page stops waiting for a rating
    const classification = classifyStoredScore(match.score)
    if (!isRatable(classification)) {
      return {
        success: true,
        rating_history: null,
        not_rated: classification.completion,
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
        reasoning_preview: rating_history.reasoning_preview,
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
    
    // A missing side returns null for that player (partial data is still returned). `why` holds the inputs the SR
    // formula used (server/utils/elo.ts); null for ratings made before it stored them.
    const view = (h: (typeof ratingHistory)[number] | undefined) =>
      h ? { elo_change: h.elo_change, elo_before: h.elo_before, elo_after: h.elo_after, why: parseExplanation(h.reasoning_preview) } : null
    return {
      success: true,
      rating_history: {
        player1: view(player1History),
        player2: view(player2History),
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
