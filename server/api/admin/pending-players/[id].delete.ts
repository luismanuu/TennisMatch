import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const pendingPlayerId = getRouterParam(event, 'id')

    if (!pendingPlayerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: pending_player_id'
      })
    }

    const supabase = getSupabaseAdmin()

    // Fetch pending player
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select('id, name, email, status')
      .eq('id', pendingPlayerId)
      .single()

    if (fetchError || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }

    // Delete the pending player record
    const { error: deleteError } = await supabase
      .from('pending_players')
      .delete()
      .eq('id', pendingPlayerId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete pending player',
        data: deleteError
      })
    }

    return {
      success: true,
      message: `Invitation for "${pendingPlayer.name}" (${pendingPlayer.email}) has been deleted successfully`,
      deletedInvitation: {
        id: pendingPlayer.id,
        name: pendingPlayer.name,
        email: pendingPlayer.email
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

