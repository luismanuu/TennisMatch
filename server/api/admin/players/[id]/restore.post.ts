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

    // Check if player exists
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

    // Check if player is actually deleted
    if (player.status !== 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player is not deleted and cannot be restored'
      })
    }

    // RESTORE: Set status back to 'active' and clear deleted_at
    const { error: updateError } = await supabase
      .from('players')
      .update({
        status: 'active',
        deleted_at: null
      })
      .eq('id', playerId)

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to restore player',
        data: updateError
      })
    }

    return {
      success: true,
      message: `Player "${player.name}" has been restored successfully`,
      restoredPlayer: {
        id: player.id,
        name: player.name,
        status: 'active'
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})




