import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      name?: string
    }>(event)
    const { clerk_id, name } = body
    const organizerId = getRouterParam(event, 'id')

    if (!clerk_id) {
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

    await requireAdmin(clerk_id)

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

    // Verify they are actually a tournament organizer
    const clerkUser = await clerkClient.users.getUser(organizer.clerk_id)
    const role = clerkUser.publicMetadata?.role as string | undefined

    if (role !== 'tournament_organizer') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is not a tournament organizer'
      })
    }

    const updateData: any = {}

    // Update name if provided
    if (name !== undefined) {
      updateData.name = name.trim()
    }

    // Update in database
    if (Object.keys(updateData).length > 0) {
      const { data: updatedOrganizer, error: updateError } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', organizerId)
        .select()
        .single()

      if (updateError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to update organizer',
          data: updateError
        })
      }

      return {
        success: true,
        message: 'Organizer updated successfully',
        organizer: updatedOrganizer
      }
    }

    return {
      success: true,
      message: 'No changes to update',
      organizer
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

