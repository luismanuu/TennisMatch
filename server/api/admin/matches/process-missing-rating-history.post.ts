/**
 * Admin endpoint to process matches that are missing rating_history
 * These are matches that were completed and marked as competitive but
 * updateRatingsAfterMatch was never called or failed
 */

import { requireAdmin } from '~/server/utils/session'
import { findMatchesMissingRatingHistory, updateRatingsAfterMatch } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const playerId = query.player_id as string | undefined
    const matchId = query.match_id as string | undefined
    const limit = parseInt(query.limit as string) || 100
    const dryRun = query.dry_run === 'true'

    const matchesToProcess = await findMatchesMissingRatingHistory({ playerId, matchId, limit })

    if (matchesToProcess.length === 0) {
      return {
        success: true,
        message: 'No matches found that need processing',
        processed: 0,
        results: []
      }
    }

    if (dryRun) {
      return {
        success: true,
        message: `Dry run: Found ${matchesToProcess.length} matches that need processing`,
        processed: 0,
        results: matchesToProcess.map(m => ({
          match_id: m.id,
          status: 'pending',
          message: 'Would be processed'
        }))
      }
    }

    // Process each match (each in its own transaction)
    const results: Array<{
      match_id: string
      status: 'success' | 'error'
      message: string
      elo_changes?: { player1: number; player2: number }
    }> = []

    for (const match of matchesToProcess) {
      try {
        const ratingResult = await updateRatingsAfterMatch(match.id)

        if (ratingResult) {
          results.push({
            match_id: match.id,
            status: 'success',
            message: `Processed successfully. Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`,
            elo_changes: {
              player1: ratingResult.player1.eloChange,
              player2: ratingResult.player2.eloChange
            }
          })
        } else {
          results.push({
            match_id: match.id,
            status: 'error',
            message: 'updateRatingsAfterMatch returned null (check logs for details)'
          })
        }
      } catch (error: unknown) {
        results.push({
          match_id: match.id,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return {
      success: true,
      message: `Processed ${successCount} matches successfully, ${errorCount} failed`,
      processed: successCount,
      failed: errorCount,
      total: matchesToProcess.length,
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
