import { and, asc, eq, ilike, inArray } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players, tournament_registrations } from '~/server/db/schema'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const query = getQuery(event)
    const tournamentId = getRouterParam(event, 'id')
    const searchTerm = typeof query.q === 'string' ? query.q : ''

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!searchTerm || searchTerm.trim().length < 2) {
      return []
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // Only players registered in this tournament, searched by name
    try {
      return await useDb().query.players.findMany({
        columns: { id: true, name: true },
        with: { category: { columns: { id: true, name: true, description: true, order: true } } },
        where: and(
          inArray(
            players.id,
            useDb()
              .select({ id: tournament_registrations.player_id })
              .from(tournament_registrations)
              .where(eq(tournament_registrations.tournament_id, tournamentId))
          ),
          ilike(players.name, `%${searchTerm.trim()}%`),
          eq(players.status, 'active')
        ),
        orderBy: [asc(players.name)],
        limit: 20,
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to search players',
        data: error
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
