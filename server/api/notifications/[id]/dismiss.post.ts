import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { notifications } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/notifications/[id]/dismiss — dismiss a notification (hide permanently).
export default defineEventHandler(async (event) => {
  const { player: currentPlayer } = await requirePlayer(event)

  try {
    const notificationId = getRouterParam(event, 'id')

    if (!notificationId) {
      throw createError({ statusCode: 400, statusMessage: 'Notification ID is required' })
    }

    // Ownership is enforced in the WHERE clause: a notification id that belongs to another
    // player updates zero rows and reads back as 404, never revealing whether it exists.
    const [notification] = UUID.test(notificationId)
      ? await useDb()
          .update(notifications)
          .set({ is_dismissed: true, dismissed_at: new Date() })
          .where(and(eq(notifications.id, notificationId), eq(notifications.player_id, currentPlayer.id)))
          .returning()
      : []

    if (!notification) {
      throw createError({ statusCode: 404, statusMessage: 'Notification not found or unauthorized' })
    }

    return { success: true, notification }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
