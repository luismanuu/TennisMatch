import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getMonthlyDecayStatus, checkAndApplyMonthlyDecay } from '~/server/utils/rating-system'
import type { MonthlyDecayStatus } from '~/types'
import { playerDecayStatusQuerySchema, playerIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const playerId = validateParam(playerIdSchema, getRouterParam(event, 'id'))
    const query = validateQuery(playerDecayStatusQuerySchema, getQuery(event))
    const applyDecay = query.apply_decay === true
    
    const supabase = getSupabaseAdmin()
    
    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, elo, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed, created_at')
      .eq('id', playerId)
      .single()
    
    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    // If requested, check and apply decay
    let decayApplied = 0
    let uncertaintyIncrease = 0
    
    if (applyDecay) {
      const decayResult = await checkAndApplyMonthlyDecay(playerId, supabase)
      if (decayResult) {
        decayApplied = decayResult.decayApplied
        uncertaintyIncrease = decayResult.uncertaintyIncrease
      }
    }
    
    // Get current status (with proportional requirement if registered mid-month)
    const status = getMonthlyDecayStatus(
      player.matches_this_month,
      player.last_decay_check,
      player.placement_matches_completed ?? 0,
      player.created_at
    )
    
    return {
      success: true,
      status,
      decay_applied: decayApplied,
      uncertainty_increase: uncertaintyIncrease,
      is_unrated: player.total_matches_played === 0,
      is_in_placement: (player.placement_matches_completed ?? 0) < 3,
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/[id]/decay-status')
  }
})
