import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body

    if (!playerId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: player_id, clerk_id'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Check if player exists and is not already deleted
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, clerk_id, name, status')
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
    // DO NOT delete from Clerk - preserve ability to restore
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
  } catch (error: unknown) {
    handleApiError(error, 'DELETE /api/admin/players/[id]')
  }
})

