import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, tournaments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { tournamentUpdateFromPayload } from '~/server/utils/tournament-status'
import type { UpdateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = (await readBody<UpdateTournamentPayload>(event)) ?? {}
    const { category_id } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const db = useDb()
    const updateData = tournamentUpdateFromPayload(body)

    // Verify tournament exists
    const existingTournament = await db.query.tournaments.findFirst({
      columns: { id: true },
      where: eq(tournaments.id, tournamentId),
    })

    if (!existingTournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    // Verify category if updating (allow null for open tournaments)
    if (category_id !== undefined && category_id !== null) {
      const category = await db.query.categories.findFirst({
        columns: { id: true },
        where: eq(categories.id, category_id),
      })

      if (!category) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Category not found'
        })
      }
    }

    // Allow setting category_id to null
    if (category_id !== undefined) {
      updateData.category_id = category_id || null
    }

    let tournament
    try {
      await db.update(tournaments).set(updateData).where(eq(tournaments.id, tournamentId))
      tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, tournamentId),
        with: { category: true, created_by_player: true, organizer: true },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update tournament',
        data: error
      })
    }

    return {
      success: true,
      message: 'Tournament updated successfully',
      tournament
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
