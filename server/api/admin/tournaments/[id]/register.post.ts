import { requireAdmin } from '~/server/utils/session'
import { registerPlayerForTournament } from '~/server/utils/tournament-status'
import type { RegisterPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<RegisterPlayerPayload>(event)
    const { player_id } = body ?? {}
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    return await registerPlayerForTournament(tournamentId, player_id)
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
