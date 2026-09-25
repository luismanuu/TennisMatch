import { and, asc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournament_matches } from '~/server/db/schema'

const playerName = { columns: { id: true, name: true } } as const

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')
    const groupId = getRouterParam(event, 'groupId')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!groupId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group ID is required'
      })
    }

    try {
      // The match embed is null when a row has no match
      return await useDb().query.tournament_matches.findMany({
        where: and(
          eq(tournament_matches.tournament_id, tournamentId),
          eq(tournament_matches.group_id, groupId),
          eq(tournament_matches.bracket_type, 'group')
        ),
        orderBy: [asc(tournament_matches.round_number), asc(tournament_matches.id)],
        with: {
          group: { columns: { id: true, group_name: true, group_number: true } },
          match: {
            columns: {
              id: true,
              player1_id: true,
              player2_id: true,
              winner_id: true,
              status: true,
              score: true,
              scheduled_at: true,
            },
            with: { player1: playerName, player2: playerName, winner: playerName },
          },
        },
      })
    } catch (error) {
      console.error('Error fetching group matches:', { error, tournamentId, groupId })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament matches',
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
