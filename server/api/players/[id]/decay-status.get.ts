import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getMonthlyDecayStatus, checkAndApplyMonthlyDecay } from '~/server/utils/rating-system'
import type { MonthlyDecayStatus } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const applyDecay = query.apply_decay === 'true'
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, elo, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed')
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
    
    // Get current status
    const status = getMonthlyDecayStatus(
      player.matches_this_month,
      player.last_decay_check,
      player.placement_matches_completed ?? 0
    )
    
    return {
      success: true,
      status,
      decay_applied: decayApplied,
      uncertainty_increase: uncertaintyIncrease,
      is_unrated: player.total_matches_played === 0,
      is_in_placement: (player.placement_matches_completed ?? 0) < 3,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
