import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournament_groups } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { recalculateGroupStandings } from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    let groups
    try {
      groups = await useDb().query.tournament_groups.findMany({
        columns: { id: true },
        where: eq(tournament_groups.tournament_id, tournamentId),
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament groups',
        data: error
      })
    }

    // Recalculate standings for each group
    const results = []
    for (const group of groups) {
      try {
        await recalculateGroupStandings(tournamentId, group.id)
        results.push({ groupId: group.id, success: true })
      } catch (error: any) {
        results.push({ groupId: group.id, success: false, error: error.message })
      }
    }

    return {
      success: true,
      message: 'Standings recalculated successfully',
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
