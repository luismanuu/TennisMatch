import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }

  try {
    // Public profile: name, category, elo, stats only. Never phone_number, user_id, or email.
    const player = UUID.test(playerId)
      ? await useDb().query.players.findFirst({
          columns: {
            id: true,
            name: true,
            category_id: true,
            city_id: true,
            elo: true,
            total_matches_played: true,
            win_streak: true,
            placement_matches_completed: true,
            created_at: true,
          },
          with: { category: true, city: true },
          where: eq(players.id, playerId),
        })
      : undefined

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    return player
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
