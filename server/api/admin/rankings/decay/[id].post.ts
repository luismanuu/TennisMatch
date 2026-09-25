import { and, eq, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { applyDecay, calculateDecayAmount, MATCHES_REQUIRED_PER_MONTH } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody(event)
    const playerId = getRouterParam(event, 'id')
    const action = body.action as 'trigger' | 'exempt'

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required',
      })
    }

    if (!action || !['trigger', 'exempt'].includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid action. Must be "trigger" or "exempt"',
      })
    }

    const db = useDb()

    // Get player
    const player = await db.query.players.findFirst({
      where: and(eq(players.id, playerId), eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: {
        id: true,
        name: true,
        elo: true,
        matches_this_month: true,
        last_decay_check: true,
        total_matches_played: true,
        placement_matches_completed: true,
      },
    })

    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
      })
    }

    if (action === 'trigger') {
      // Manually trigger decay
      const isInPlacement = (player.placement_matches_completed || 0) < 3

      if (isInPlacement) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot apply decay to players in placement matches',
        })
      }

      // Calculate decay amount
      const decayAmount = calculateDecayAmount(player.matches_this_month || 0)
      const newElo = applyDecay(player.elo || 0, decayAmount)

      // Apply decay
      await db
        .update(players)
        .set({
          elo: newElo,
          last_decay_check: new Date().toISOString().split('T')[0],
          matches_this_month: 0, // Reset for new month
        })
        .where(eq(players.id, playerId))

      return {
        success: true,
        message: `Decay applied to ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          elo_before: player.elo,
          elo_after: newElo,
          decay_amount: decayAmount,
        },
      }
    } else if (action === 'exempt') {
      // Exempt player from decay (by setting matches_this_month to required amount)
      await db.update(players).set({ matches_this_month: MATCHES_REQUIRED_PER_MONTH }).where(eq(players.id, playerId))

      return {
        success: true,
        message: `${player.name} exempted from decay`,
        player: {
          id: player.id,
          name: player.name,
          matches_this_month: MATCHES_REQUIRED_PER_MONTH,
        },
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
