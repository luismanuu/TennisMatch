import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const organizerId = getRouterParam(event, 'id')

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!organizerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Organizer ID is required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()
    const clerkClient = getClerkClient()

    // Get organizer player record
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id, clerk_id, name')
      .eq('id', organizerId)
      .single()

    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    // Check if organizer has created any tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('organizer_id', organizerId)

    if (tournamentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to check tournaments',
        data: tournamentsError
      })
    }

    if (tournaments && tournaments.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot delete organizer: they have created ${tournaments.length} tournament(s). Please transfer or delete tournaments first.`
      })
    }

    // Remove tournament_organizer role from Clerk user
    try {
      await clerkClient.users.updateUser(organizer.clerk_id, {
        publicMetadata: {
          role: 'player' // Revert to player role
        }
      })
    } catch (clerkError: any) {
      console.warn('Could not update Clerk user role:', clerkError)
      // Continue with deletion even if Clerk update fails
    }

    // Delete player record (this will cascade to related records)
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', organizerId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete organizer',
        data: deleteError
      })
    }

    return {
      success: true,
      message: 'Organizer deleted successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

