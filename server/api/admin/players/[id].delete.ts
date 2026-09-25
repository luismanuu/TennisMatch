import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const playerId = getRouterParam(event, 'id')

    if (!playerId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: player_id' })
    }

    const db = useDb()

    const player = UUID.test(playerId)
      ? await db.query.players.findFirst({ columns: { id: true, name: true, status: true }, where: eq(players.id, playerId) })
      : undefined

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    if (player.status === 'deleted') {
      throw createError({ statusCode: 400, statusMessage: 'Player is already deleted' })
    }

    // SOFT DELETE: preserve match history and the account; only the player row's status changes.
    await db.update(players).set({ status: 'deleted', deleted_at: new Date() }).where(eq(players.id, playerId))

    return {
      success: true,
      message: `Player "${player.name}" has been marked as deleted. All match history has been preserved.`,
      deletedPlayer: { id: player.id, name: player.name, status: 'deleted' },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
