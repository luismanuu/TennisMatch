import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournament_matches } from '~/server/db/schema'
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

    try {
      return await useDb().query.tournament_matches.findMany({
        where: eq(tournament_matches.tournament_id, tournamentId),
        with: {
          match: {
            columns: {
              id: true,
              player1_id: true,
              player2_id: true,
              status: true,
              scheduled_at: true,
              played_at: true,
              score: true,
              winner_id: true,
            },
          },
        },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament matches',
        data: error
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
