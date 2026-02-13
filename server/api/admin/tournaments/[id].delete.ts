import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { clerkIdQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Verify tournament exists
    const { data: tournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .single()

    if (fetchError || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Delete tournament (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete tournament',
        data: deleteError
      })
    }

    return {
      success: true,
      message: 'Tournament deleted successfully'
    }
  } catch (error: unknown) {
    handleApiError(error, 'DELETE /api/admin/tournaments/[id]')
  }
})

