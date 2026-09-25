import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { notifications } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'

// POST /api/notifications/mark-all-read — mark all notifications as read for the current player.
export default defineEventHandler(async (event) => {
  const { player: currentPlayer } = await requirePlayer(event)

  try {
    const updated = await useDb()
      .update(notifications)
      .set({ is_read: true, read_at: new Date() })
      .where(
        and(
          eq(notifications.player_id, currentPlayer.id),
          eq(notifications.is_read, false),
          eq(notifications.is_dismissed, false),
        ),
      )
      .returning()

    return { success: true, count: updated.length, notifications: updated }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
