import { eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { getAccountById } from '~/server/utils/users'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// [id] is the organizer's player id. Updates the player-profile name, as before.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{ name?: string }>(event)
    const name = body?.name
    const organizerId = getRouterParam(event, 'id')

    if (!organizerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Organizer ID is required'
      })
    }

    const db = useDb()
    const organizer = UUID.test(organizerId)
      ? await db.query.players.findFirst({ where: eq(players.id, organizerId) })
      : undefined

    if (!organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    // Verify they are actually a tournament organizer
    const account = await getAccountById(organizer.user_id)
    if (account?.role !== 'tournament_organizer') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is not a tournament organizer'
      })
    }

    if (name !== undefined) {
      const [updatedOrganizer] = await db
        .update(players)
        .set({ name: name.trim(), updated_at: new Date() })
        .where(eq(players.id, organizer.id))
        .returning()

      return {
        success: true,
        message: 'Organizer updated successfully',
        organizer: updatedOrganizer
      }
    }

    return {
      success: true,
      message: 'No changes to update',
      organizer
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
