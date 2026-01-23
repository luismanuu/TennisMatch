import { getSupabaseAdmin } from '~/server/utils/supabase'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/admin'

/**
 * Admin endpoint to force recalculate a match
 * This will reverse existing rating_history entries and recalculate (with LLM if API key is set)
 * Works for any match, regardless of whether it used LLM or fallback
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const matchId = query.match_id as string | undefined
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    // Verify admin access
    await requireAdmin(clerkId)

    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Verify match exists and is completed
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, score, player1_id, player2_id, winner_id')
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
        statusMessage: 'Match must be completed to recalculate ratings'
      })
    }

    if (!match.score) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match must have a score to recalculate ratings'
      })
    }

    // Step 1: Get rating history for this match (including reversed entries)
    // We need to reverse any existing entries, whether they're reversed or not
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select('*')
      .eq('match_id', matchId)
      // Get all entries, but prioritize non-reversed ones
      .order('rating_reversed', { ascending: true })

    if (historyError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history',
        data: historyError
      })
    }

    // Check if we have any rating history (reversed or not)
    const hasReversedEntries = ratingHistory && ratingHistory.some((h: any) => h.rating_reversed)
    const hasNonReversedEntries = ratingHistory && ratingHistory.some((h: any) => !h.rating_reversed)

    if (!ratingHistory || ratingHistory.length === 0) {
      // No rating history at all - just recalculate directly
      const ratingResult = await updateRatingsAfterMatch(matchId, supabase)
      if (ratingResult) {
        return {
          success: true,
          message: `Successfully calculated. Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`,
          match_id: matchId,
          result: {
            player1_elo_change: ratingResult.player1.eloChange,
            player2_elo_change: ratingResult.player2.eloChange,
            llm_used: ratingResult.llmUsed || false
          }
        }
      }
      return {
        success: false,
        message: 'Calculation returned null',
        match_id: matchId
      }
    }

    // Step 2: Reverse rating history entries (only if not already reversed)
    const playerIds = new Set<string>()

    for (const entry of ratingHistory) {
      playerIds.add(entry.player_id)

      // Only mark as reversed if not already reversed
      if (!entry.rating_reversed) {
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
    }

    // Step 3: Revert player ELOs and stats (only if we had non-reversed entries)
    if (hasNonReversedEntries) {
      for (const playerId of playerIds) {
        // Get player's current state
        const { data: player, error: playerError } = await supabase
          .from('players')
          .select('elo, mmr, mmr_uncertainty, total_matches_played, placement_matches_completed')
          .eq('id', playerId)
          .single()

        if (playerError || !player) {
          throw new Error(`Failed to fetch player ${playerId}: ${playerError?.message}`)
        }

        // Find the non-reversed rating history entry for this player (use original values)
        const playerHistory = ratingHistory.find((h: any) => h.player_id === playerId && !h.rating_reversed)
        if (!playerHistory) continue

        // Calculate new ELO (subtract the change)
        const newElo = Math.max(1000, player.elo - playerHistory.elo_change)
        
        // Revert MMR (subtract the change)
        const newMmr = Math.max(0, parseFloat(player.mmr.toString()) - parseFloat(playerHistory.mmr_change.toString()))
        
        // Revert uncertainty (subtract the change)
        const newUncertainty = Math.max(0, parseFloat(player.mmr_uncertainty.toString()) - 
          (parseFloat(playerHistory.uncertainty_after.toString()) - parseFloat(playerHistory.uncertainty_before.toString())))

        // Revert total matches
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
          })
          .eq('id', playerId)

        if (updateError) {
          throw new Error(`Failed to revert player ${playerId}: ${updateError.message}`)
        }
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
      .eq('id', matchId)

    // Step 5: Recalculate with LLM (if API key is set)
    const ratingResult = await updateRatingsAfterMatch(matchId, supabase)

    if (ratingResult) {
      return {
        success: true,
        message: `Successfully recalculated. Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`,
        match_id: matchId,
        result: {
          player1_elo_change: ratingResult.player1.eloChange,
          player2_elo_change: ratingResult.player2.eloChange,
          llm_used: ratingResult.llmUsed || false
        }
      }
    } else {
      return {
        success: false,
        message: 'Recalculation returned null (check logs for details)',
        match_id: matchId
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error
    })
  }
})
