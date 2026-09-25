import { requireAdmin } from '~/server/utils/session'
import { createGroupStageDeadline } from '~/server/utils/tournament-scheduling'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{ deadline: string }>(event)
    const deadline = body?.deadline
    const tournamentId = getRouterParam(event, 'id')

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

    await createGroupStageDeadline(tournamentId, deadline)

    return {
      success: true,
      message: 'Group stage deadline set successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
