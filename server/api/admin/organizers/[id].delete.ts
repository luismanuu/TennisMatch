import { count, eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { getAccountById, setAccountRole } from '~/server/utils/users'
import { useDb } from '~/server/db'
import { players, tournaments } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// [id] is the organizer's player id, or the account id for an organizer without a player profile
// (see organizers/index.get). Removing an organizer demotes the account to 'player'; the player
// profile and its history stay.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const organizerId = getRouterParam(event, 'id')

    if (!organizerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Organizer ID is required'
      })
    }

    const db = useDb()
    const player = UUID.test(organizerId)
      ? await db.query.players.findFirst({ columns: { id: true, user_id: true }, where: eq(players.id, organizerId) })
      : undefined
    const account = await getAccountById(player?.user_id ?? organizerId)

    if (!account || account.role !== 'tournament_organizer') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    // Check if organizer has created any tournaments
    if (player) {
      const [{ value: tournamentCount }] = await db
        .select({ value: count() })
        .from(tournaments)
        .where(eq(tournaments.organizer_id, player.id))

      if (tournamentCount > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Cannot delete organizer: they have created ${tournamentCount} tournament(s). Please transfer or delete tournaments first.`
        })
      }
    }

    await setAccountRole(account.id, 'player')

    return {
      success: true,
      message: 'Organizer deleted successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
