import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const pendingPlayerId = getRouterParam(event, 'id')

    if (!pendingPlayerId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: pending_player_id' })
    }

    const db = useDb()

    const pendingPlayer = UUID.test(pendingPlayerId)
      ? await db.query.pending_players.findFirst({
          columns: { id: true, name: true, email: true },
          where: eq(pending_players.id, pendingPlayerId),
        })
      : undefined

    if (!pendingPlayer) {
      throw createError({ statusCode: 404, statusMessage: 'Pending player not found' })
    }

    await db.delete(pending_players).where(eq(pending_players.id, pendingPlayerId))

    return {
      success: true,
      message: `Invitation for "${pendingPlayer.name}" (${pendingPlayer.email}) has been deleted successfully`,
      deletedInvitation: { id: pendingPlayer.id, name: pendingPlayer.name, email: pendingPlayer.email },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
