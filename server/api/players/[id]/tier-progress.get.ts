import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getNextTierProgress } from '~/server/utils/rating-system'
import { playerIdSchema, validateParam } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const playerId = validateParam(playerIdSchema, getRouterParam(event, 'id'))
    
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
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/[id]/tier-progress')
  }
})
