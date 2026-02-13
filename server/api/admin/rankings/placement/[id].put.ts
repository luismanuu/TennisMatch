import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminPlacementActionBodySchema, clerkIdQuerySchema, playerIdSchema, validateBody, validateParam, validateQuery } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const { clerk_id: clerkId } = validateQuery(clerkIdQuerySchema, getQuery(event))
    const playerId = validateParam(playerIdSchema, getRouterParam(event, 'id'))
    const { action } = validateBody(adminPlacementActionBodySchema, await readBody(event))

    await requireAdmin(clerkId)

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
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/admin/rankings/placement/[id]')
  }
})
