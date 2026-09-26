import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, tournament_groups, tournament_matches, tournaments } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { publicPlayer } from '~/server/utils/public-player'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { tournamentUpdateFromPayload } from '~/server/utils/tournament-status'
import type { UpdateTournamentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const body = (await readBody<UpdateTournamentPayload>(event)) ?? {}
    const { category_id, status } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const db = useDb()

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // If status is being changed to 'active', verify brackets are generated
    if (status === 'active') {
      const group = await db.query.tournament_groups.findFirst({
        columns: { id: true },
        where: eq(tournament_groups.tournament_id, tournamentId),
      })

      if (!group) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot start tournament: brackets must be generated first'
        })
      }

      const groupMatch = await db.query.tournament_matches.findFirst({
        columns: { id: true },
        where: and(eq(tournament_matches.tournament_id, tournamentId), eq(tournament_matches.bracket_type, 'group')),
      })

      if (!groupMatch) {
        // Groups without matches should not happen after a generation; allowed, the organizer can regenerate
        console.warn(`Tournament ${tournamentId} has groups but no matches. Organizer should generate brackets.`)
      }
    }

    const updateData = tournamentUpdateFromPayload(body)

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
        with: { category: true, organizer: publicPlayer },
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
