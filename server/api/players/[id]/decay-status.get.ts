import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { getMonthlyDecayStatus } from '~/server/utils/rating-system'

// Read-only: decay itself runs from the scheduled job (server/api/cron/monthly-decay.get.ts).
// decay_applied and uncertainty_increase stay in the response, always 0, for the existing client.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }

  try {
    const db = useDb()
    const player = UUID.test(playerId)
      ? await db.query.players.findFirst({
          columns: {
            id: true,
            elo: true,
            matches_this_month: true,
            last_decay_check: true,
            total_matches_played: true,
            placement_matches_completed: true,
            created_at: true,
          },
          where: eq(players.id, playerId),
        })
      : undefined

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    const status = getMonthlyDecayStatus(
      player.matches_this_month ?? 0,
      player.last_decay_check,
      player.placement_matches_completed ?? 0,
      player.created_at,
    )

    return {
      success: true,
      status,
      decay_applied: 0,
      uncertainty_increase: 0,
      is_unrated: player.total_matches_played === 0,
      is_in_placement: (player.placement_matches_completed ?? 0) < 3,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
