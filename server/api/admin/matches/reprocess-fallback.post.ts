import { getSupabaseAdmin } from '~/server/utils/supabase'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/admin'

/**
 * Admin endpoint to reprocess matches that used fallback calculation
 * This will reverse existing rating_history entries and recalculate with LLM
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    // Verify admin access
    await requireAdmin(clerkId)
    const matchId = query.match_id as string | undefined
    const limit = parseInt(query.limit as string) || 100
    const dryRun = query.dry_run === 'true'

    const supabase = getSupabaseAdmin()

    // Find matches that used fallback calculation
    // Fallback matches are:
    // 1. llm_calculation_failed = true (LLM attempted but failed)
    // 2. OR (llm_elo_calculated = false AND llm_calculation_failed = false) (no API key/not attempted)
    let matchesQuery = supabase
      .from('matches')
      .select('id, player1_id, player2_id, status, score, played_at, created_at')
      .eq('status', 'completed')
      .or('llm_calculation_failed.eq.true,and(llm_elo_calculated.eq.false,llm_calculation_failed.eq.false)')
      .not('score', 'is', null)
      .order('created_at', { ascending: true }) // Process in chronological order

    if (matchId) {
      matchesQuery = matchesQuery.eq('id', matchId)
    } else {
      matchesQuery = matchesQuery.limit(limit)
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
        message: 'No matches found that used fallback calculation',
        processed: 0,
        results: []
      }
    }

    const results: Array<{
      match_id: string
      status: 'success' | 'error' | 'skipped'
      message: string
      error?: string
    }> = []

    if (dryRun) {
      return {
        success: true,
        message: `DRY RUN: Would reprocess ${matches.length} match(es)`,
        matches: matches.map(m => ({
          id: m.id,
          played_at: m.played_at,
          score: m.score
        })),
        processed: 0,
        results: []
      }
    }

    // Process matches in chronological order
    for (const match of matches) {
      try {
        // Step 1: Get rating history for this match
        const { data: ratingHistory, error: historyError } = await supabase
          .from('rating_history')
          .select('*')
          .eq('match_id', match.id)
          .eq('rating_reversed', false)

        if (historyError) {
          results.push({
            match_id: match.id,
            status: 'error',
            message: 'Failed to fetch rating history',
            error: historyError.message
          })
          continue
        }

        if (!ratingHistory || ratingHistory.length === 0) {
          // No rating history - this match was never calculated, so just calculate it directly
          // Clear LLM-related fields first
          await supabase
            .from('matches')
            .update({
              llm_elo_calculated: null,
              llm_calculation_failed: null,
              llm_calculation_reasoning: null,
              llm_calculation_model: null,
              llm_calculation_timestamp: null
            })
            .eq('id', match.id)

          // Calculate directly (no reversal needed)
          const ratingResult = await updateRatingsAfterMatch(match.id, supabase)

          if (ratingResult) {
            const llmStatus = ratingResult.llmUsed 
              ? 'LLM calculation used' 
              : ratingResult.llmFailed 
                ? 'LLM calculation failed, used fallback' 
                : 'Fallback calculation used (no API key or other reason)'
            
            results.push({
              match_id: match.id,
              status: 'success',
              message: `Match had no previous calculation. ${llmStatus}. Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`,
              llm_used: ratingResult.llmUsed || false,
              llm_failed: ratingResult.llmFailed || false
            })
          } else {
            results.push({
              match_id: match.id,
              status: 'error',
              message: 'Calculation returned null (check logs for details)'
            })
          }
          continue
        }

        // Step 2: Reverse rating history entries
        const playerIds = new Set<string>()
        const eloReversals: Array<{ playerId: string; eloChange: number }> = []

        for (const entry of ratingHistory) {
          playerIds.add(entry.player_id)
          eloReversals.push({
            playerId: entry.player_id,
            eloChange: -entry.elo_change // Reverse the change
          })

          // Mark as reversed
          const { error: reverseError } = await supabase
            .from('rating_history')
            .update({
              rating_reversed: true,
              reversed_at: new Date().toISOString()
            })
            .eq('id', entry.id)

          if (reverseError) {
            throw new Error(`Failed to reverse rating history ${entry.id}: ${reverseError.message}`)
          }
        }

        // Step 3: Revert player ELOs and stats
        for (const playerId of playerIds) {
          // Get player's current state
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('elo, mmr, mmr_uncertainty, total_matches_played, win_streak, loss_streak, placement_matches_completed')
            .eq('id', playerId)
            .single()

          if (playerError || !player) {
            throw new Error(`Failed to fetch player ${playerId}: ${playerError?.message}`)
          }

          // Find the rating history entry for this player
          const playerHistory = ratingHistory.find(h => h.player_id === playerId)
          if (!playerHistory) continue

          // Calculate new ELO (subtract the change)
          const newElo = Math.max(1000, player.elo - playerHistory.elo_change)
          
          // Revert MMR (subtract the change)
          const newMmr = Math.max(0, parseFloat(player.mmr.toString()) - parseFloat(playerHistory.mmr_change.toString()))
          
          // Revert uncertainty (subtract the change)
          const newUncertainty = Math.max(0, parseFloat(player.mmr_uncertainty.toString()) - 
            (parseFloat(playerHistory.uncertainty_after.toString()) - parseFloat(playerHistory.uncertainty_before.toString())))

          // Revert win/loss streaks (this is complex, we'll need to check previous matches)
          // For now, we'll just decrement total matches and let the recalculation fix streaks
          const newTotalMatches = Math.max(0, player.total_matches_played - 1)

          // Revert placement matches if this was a placement match
          let newPlacementCount = player.placement_matches_completed
          if (playerHistory.is_placement_match && player.placement_matches_completed > 0) {
            newPlacementCount = Math.max(0, player.placement_matches_completed - 1)
          }

          // Update player
          const { error: updateError } = await supabase
            .from('players')
            .update({
              elo: newElo,
              mmr: newMmr,
              mmr_uncertainty: newUncertainty,
              total_matches_played: newTotalMatches,
              placement_matches_completed: newPlacementCount
              // Note: We don't revert win_streak/loss_streak here as it's complex
              // The recalculation will fix these based on actual match history
            })
            .eq('id', playerId)

          if (updateError) {
            throw new Error(`Failed to revert player ${playerId}: ${updateError.message}`)
          }
        }

        // Step 4: Clear LLM-related fields from match
        await supabase
          .from('matches')
          .update({
            llm_elo_calculated: null,
            llm_calculation_failed: null,
            llm_calculation_reasoning: null,
            llm_calculation_model: null,
            llm_calculation_timestamp: null
          })
          .eq('id', match.id)

        // Step 5: Recalculate with LLM (if API key is set)
        const ratingResult = await updateRatingsAfterMatch(match.id, supabase)

        if (ratingResult) {
          const llmStatus = ratingResult.llmUsed 
            ? 'LLM calculation used' 
            : ratingResult.llmFailed 
              ? 'LLM calculation failed, used fallback' 
              : 'Fallback calculation used (no API key or other reason)'
          
          results.push({
            match_id: match.id,
            status: 'success',
            message: `Successfully reprocessed. ${llmStatus}. Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`,
            llm_used: ratingResult.llmUsed || false,
            llm_failed: ratingResult.llmFailed || false
          })
        } else {
          results.push({
            match_id: match.id,
            status: 'error',
            message: 'Recalculation returned null (check logs for details)'
          })
        }
      } catch (error: any) {
        results.push({
          match_id: match.id,
          status: 'error',
          message: 'Failed to reprocess match',
          error: error.message || 'Unknown error'
        })
        console.error(`Error reprocessing match ${match.id}:`, error)
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length
    const skippedCount = results.filter(r => r.status === 'skipped').length

    return {
      success: true,
      message: `Processed ${matches.length} match(es): ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`,
      processed: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error
    })
  }
})
