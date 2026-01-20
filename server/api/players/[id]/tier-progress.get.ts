import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getNextTierProgress } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch player's ELO
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('elo')
      .eq('id', playerId)
      .single()
    
    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    const progress = getNextTierProgress(player.elo)
    
    return {
      success: true,
      progress
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
