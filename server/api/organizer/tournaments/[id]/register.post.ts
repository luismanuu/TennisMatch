import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { registerPlayerForTournament } from '~/server/utils/tournament-status'
import type { RegisterPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const body = await readBody<RegisterPlayerPayload>(event)
    const { player_id } = body ?? {}
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId || !player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID and Player ID are required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    return await registerPlayerForTournament(tournamentId, player_id)
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
