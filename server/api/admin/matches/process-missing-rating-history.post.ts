/**
 * Admin endpoint to process matches that are missing rating_history
 * These are matches that were completed and marked as competitive but
 * updateRatingsAfterMatch was never called or failed silently
 */

import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const playerId = query.player_id as string | undefined
    const matchId = query.match_id as string | undefined
    const limit = parseInt(query.limit as string) || 100
    const dryRun = query.dry_run === 'true'

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    // Verify admin access
    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build query to find matches missing rating_history
    let matchesQuery = supabase
      .from('matches')
      .select('id, status, is_competitive, score, winner_id, player1_id, player2_id, played_at, created_at')
      .eq('status', 'completed')
      .eq('is_competitive', true)
      .not('winner_id', 'is', null)
      .not('player1_id', 'is', null)
      .not('player2_id', 'is', null)

    // Filter by player if provided
    if (playerId) {
      matchesQuery = matchesQuery.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    }

    // Filter by specific match if provided
    if (matchId) {
      matchesQuery = matchesQuery.eq('id', matchId)
    } else {
      matchesQuery = matchesQuery.order('created_at', { ascending: true }).limit(limit)
    }

    const { data: matches, error: matchesError } = await matchesQuery

    if (matchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches',
        data: matchesError
      })
    }

    if (!matches || matches.length === 0) {
      return {
        success: true,
        message: 'No matches found that need processing',
        processed: 0,
        results: []
      }
    }

    // Filter out matches that already have rating_history or are invalid
    const matchesToProcess: typeof matches = []

    for (const match of matches) {
      // Skip self-matches
      if (match.player1_id === match.player2_id) {
        continue
      }

      // Check if rating_history exists
      const { data: history } = await supabase
        .from('rating_history')
        .select('id')
        .eq('match_id', match.id)
        .eq('rating_reversed', false)
        .limit(1)

      if (!history || history.length === 0) {
        matchesToProcess.push(match)
      }
    }

    if (matchesToProcess.length === 0) {
      return {
        success: true,
        message: 'All matches already have rating_history',
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

    // Process each match
    const results: Array<{
      match_id: string
      status: 'success' | 'error'
      message: string
      elo_changes?: { player1: number; player2: number }
    }> = []

    for (const match of matchesToProcess) {
      try {
        const ratingResult = await updateRatingsAfterMatch(match.id, supabase)

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
      } catch (error: any) {
        results.push({
          match_id: match.id,
          status: 'error',
          message: error.message || 'Unknown error'
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
