import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { createGroupStageDeadline } from '~/server/utils/tournament-scheduling'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ clerk_id: string; deadline: string }>(event)
    const { clerk_id, deadline } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!deadline) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Deadline is required'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    await createGroupStageDeadline(tournamentId, deadline, supabase)

    return {
      success: true,
      message: 'Group stage deadline set successfully'
    }
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/admin/tournaments/[id]/group-deadline')
  }
})

