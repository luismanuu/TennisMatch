import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { PUBLIC_PLAYER_COLUMNS, publicPlayer } from '~/server/utils/public-player'

export default defineEventHandler(async (event) => {
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
        created_by_player: publicPlayer,
        organizer: publicPlayer,
        registrations: { with: { player: { columns: PUBLIC_PLAYER_COLUMNS, with: { category: true } } } },
        groups: { with: { players: { with: { player: publicPlayer } } } },
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
