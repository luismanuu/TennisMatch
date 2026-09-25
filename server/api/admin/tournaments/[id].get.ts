import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const tournament = await useDb().query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: {
        category: true,
        created_by_player: true,
        organizer: true,
        registrations: { with: { player: true } },
        groups: { with: { players: { with: { player: true } } } },
        rounds: true,
      },
    })

    if (!tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    return tournament
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
