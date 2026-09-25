import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody(event)
    const playerId = getRouterParam(event, 'id')
    const action = body.action as 'reset' | 'complete'

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    if (!action || !['reset', 'complete'].includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid action. Must be "reset" or "complete"'
      })
    }

    const supabase = getSupabaseAdmin()

    // Get player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, placement_matches_completed, total_matches_played')
      .eq('id', playerId)
      .eq('status', 'active')
      .single()

    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
        data: playerError
      })
    }

    if (action === 'reset') {
      // Reset placement matches
      const { error: updateError } = await supabase
        .from('players')
        .update({
          placement_matches_completed: 0
        })
        .eq('id', playerId)

      if (updateError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to reset placement matches',
          data: updateError
        })
      }

      return {
        success: true,
        message: `Placement matches reset for ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          placement_matches_completed: 0
        }
      }
    } else if (action === 'complete') {
      // Mark placement matches as complete (admin override)
      const { error: updateError } = await supabase
        .from('players')
        .update({
          placement_matches_completed: 3
        })
        .eq('id', playerId)

      if (updateError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to complete placement matches',
          data: updateError
        })
      }

      return {
        success: true,
        message: `Placement matches marked as complete for ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          placement_matches_completed: 3
        }
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
