import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, rating_history } from '~/server/db/schema'
import { clearLlmCalculation, reverseMatchRatings, updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/session'
import type { RatingCalculationResult } from '~/types'

// Thrown inside the transaction so a recalculation that produced nothing also undoes the reversal
class NothingRecalculated extends Error {}

function signed(change: number): string {
  return `${change > 0 ? '+' : ''}${change}`
}

function summary(result: RatingCalculationResult) {
  return {
    player1_elo_change: result.player1.eloChange,
    player2_elo_change: result.player2.eloChange,
    llm_used: result.llmUsed || false
  }
}

/**
 * Admin endpoint to force recalculate a match
 * This will reverse existing rating_history entries and recalculate (with LLM if API key is set)
 * Works for any match, regardless of whether it used LLM or fallback.
 * The reversal and the recalculation run in one transaction: either both apply or neither does.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const matchId = query.match_id as string | undefined
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }

    const db = useDb()

    // Verify match exists and is completed
    const match = await db.query.matches.findFirst({
      columns: { id: true, status: true, score: true, player1_id: true, player2_id: true, winner_id: true },
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
        statusMessage: 'Match must be completed to recalculate ratings'
      })
    }

    if (!match.score) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match must have a score to recalculate ratings'
      })
    }

    // Any rating history at all (reversed or not)?
    const anyHistory = await db.query.rating_history.findFirst({
      columns: { id: true },
      where: eq(rating_history.match_id, matchId),
    })

    if (!anyHistory) {
      // No rating history at all - just calculate directly
      const ratingResult = await updateRatingsAfterMatch(matchId)
      if (ratingResult) {
        return {
          success: true,
          message: `Successfully calculated. Player1: ${signed(ratingResult.player1.eloChange)} ELO, Player2: ${signed(ratingResult.player2.eloChange)} ELO`,
          match_id: matchId,
          result: summary(ratingResult)
        }
      }
      return {
        success: false,
        message: 'Calculation returned null',
        match_id: matchId
      }
    }

    let ratingResult: RatingCalculationResult
    try {
      ratingResult = await db.transaction(async (tx) => {
        await reverseMatchRatings(matchId, tx)
        await clearLlmCalculation(matchId, tx)
        const result = await updateRatingsAfterMatch(matchId, tx)
        if (!result) {
          throw new NothingRecalculated()
        }
        return result
      })
    } catch (error) {
      if (error instanceof NothingRecalculated) {
        return {
          success: false,
          message: 'Recalculation returned null (check logs for details)',
          match_id: matchId
        }
      }
      throw error
    }

    return {
      success: true,
      message: `Successfully recalculated. Player1: ${signed(ratingResult.player1.eloChange)} ELO, Player2: ${signed(ratingResult.player2.eloChange)} ELO`,
      match_id: matchId,
      result: summary(ratingResult)
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error
    })
  }
})
