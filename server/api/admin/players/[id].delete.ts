import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { deleteClerkUser } from '~/server/utils/clerk'

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

    // Check if player exists
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, clerk_id, name')
      .eq('id', playerId)
      .single()

    if (fetchError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Check if player has matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},winner_id.eq.${playerId}`)
      .limit(1)

    if (matchesError) {
      console.error('Error checking matches:', matchesError)
    }

    // If player has matches, we need to handle them
    // Option 1: Delete all matches (cascade)
    // Option 2: Set player references to NULL (if allowed by schema)
    // For now, we'll delete matches where this player is involved
    // This is a destructive operation, so we log it
    if (matches && matches.length > 0) {
      // Delete matches where this player is player1, player2, or winner
      const { error: deleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},winner_id.eq.${playerId}`)

      if (deleteMatchesError) {
        console.warn('Warning: Failed to delete some matches for player:', deleteMatchesError)
        // Continue with player deletion even if match deletion fails
      }
    }

    // Update pending_players to set invited_by_player_id to NULL if it references this player
    const { error: updatePendingError } = await supabase
      .from('pending_players')
      .update({ invited_by_player_id: null })
      .eq('invited_by_player_id', playerId)

    if (updatePendingError) {
      console.warn('Warning: Failed to update pending_players:', updatePendingError)
      // Continue with player deletion
    }

    // Delete the user from Clerk first (before deleting from database)
    // This ensures the user cannot sign in after deletion
    try {
      console.log('Deleting user from Clerk:', player.clerk_id)
      await deleteClerkUser(player.clerk_id)
      console.log('Successfully deleted user from Clerk')
    } catch (clerkError: any) {
      console.error('Error deleting user from Clerk:', clerkError)
      // If Clerk deletion fails, we should still try to delete from database
      // But log a warning - this could leave orphaned records
      console.warn('Warning: Failed to delete user from Clerk, but continuing with database deletion')
      // You might want to throw an error here instead, depending on your requirements
      // For now, we'll continue but log the issue
    }

    // Delete the player from database
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete player from database',
        data: deleteError
      })
    }

    return {
      success: true,
      message: `Player "${player.name}" has been deleted successfully`,
      deletedPlayer: {
        id: player.id,
        name: player.name
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

