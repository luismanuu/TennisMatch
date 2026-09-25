import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { createGroupStageDeadline } from '~/server/utils/tournament-scheduling'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

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

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

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

