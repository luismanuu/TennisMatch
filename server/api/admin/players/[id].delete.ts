import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const playerId = getRouterParam(event, 'id')

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: player_id'
      })
    }

    const supabase = getSupabaseAdmin()

    // Check if player exists and is not already deleted
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, user_id, name, status')
      .eq('id', playerId)
      .single()

    if (fetchError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Check if already deleted
    if (player.status === 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player is already deleted'
      })
    }

    // SOFT DELETE: Set status to 'deleted' and set deleted_at timestamp
    // DO NOT delete matches - preserve all match history
    // DO NOT delete the account - preserve ability to restore
    const { error: updateError } = await supabase
      .from('players')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString()
      })
      .eq('id', playerId)

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete player',
        data: updateError
      })
    }

    return {
      success: true,
      message: `Player "${player.name}" has been marked as deleted. All match history has been preserved.`,
      deletedPlayer: {
        id: player.id,
        name: player.name,
        status: 'deleted'
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

