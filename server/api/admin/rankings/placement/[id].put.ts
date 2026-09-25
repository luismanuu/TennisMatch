import { and, eq, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody(event)
    const playerId = getRouterParam(event, 'id')
    const action = body.action as 'reset' | 'complete'

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required',
      })
    }

    if (!action || !['reset', 'complete'].includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid action. Must be "reset" or "complete"',
      })
    }

    const db = useDb()

    // Get player
    const player = await db.query.players.findFirst({
      where: and(eq(players.id, playerId), eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: { id: true, name: true, placement_matches_completed: true, total_matches_played: true },
    })

    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
      })
    }

    if (action === 'reset') {
      // Reset placement matches
      await db.update(players).set({ placement_matches_completed: 0 }).where(eq(players.id, playerId))

      return {
        success: true,
        message: `Placement matches reset for ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          placement_matches_completed: 0,
        },
      }
    } else if (action === 'complete') {
      // Mark placement matches as complete (admin override)
      await db.update(players).set({ placement_matches_completed: 3 }).where(eq(players.id, playerId))

      return {
        success: true,
        message: `Placement matches marked as complete for ${player.name}`,
        player: {
          id: player.id,
          name: player.name,
          placement_matches_completed: 3,
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
