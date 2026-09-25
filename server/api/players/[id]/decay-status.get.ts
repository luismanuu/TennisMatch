import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { checkAndApplyMonthlyDecay, getMonthlyDecayStatus } from '~/server/utils/rating-system'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const applyDecay = query.apply_decay === 'true'

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

    let decayApplied = 0
    let uncertaintyIncrease = 0

    if (applyDecay) {
      const decayResult = await checkAndApplyMonthlyDecay(playerId)
      if (decayResult) {
        decayApplied = decayResult.decayApplied
        uncertaintyIncrease = decayResult.uncertaintyIncrease
      }
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
      decay_applied: decayApplied,
      uncertainty_increase: uncertaintyIncrease,
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
