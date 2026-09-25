import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const db = useDb()

    // Verify tournament exists
    const tournament = await db.query.tournaments.findFirst({
      columns: { id: true },
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Related rows cascade; the database also deletes the tournament's unplayed matches (migration 0002)
    try {
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId))
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete tournament',
        data: error
      })
    }

    return {
      success: true,
      message: 'Tournament deleted successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
