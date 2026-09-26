import { asc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournament_groups, tournament_matches } from '~/server/db/schema'
import { publicPlayer } from '~/server/utils/public-player'

const playerName = { columns: { id: true, name: true } } as const

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    const db = useDb()
    let groups
    let matches
    try {
      // Groups with players and standings
      groups = await db.query.tournament_groups.findMany({
        where: eq(tournament_groups.tournament_id, tournamentId),
        orderBy: [asc(tournament_groups.group_number)],
        with: {
          players: { with: { player: publicPlayer } },
          standings: { with: { player: publicPlayer } },
        },
      })

      // Tournament matches, ordered by round and position
      matches = await db.query.tournament_matches.findMany({
        where: eq(tournament_matches.tournament_id, tournamentId),
        orderBy: [asc(tournament_matches.round_number), asc(tournament_matches.bracket_position)],
        with: {
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
          group: { columns: { id: true, group_name: true, group_number: true } },
        },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch bracket data',
        data: error
      })
    }

    // Organize matches by bracket type
    return {
      groups,
      main: matches.filter(m => m.bracket_type === 'main'),
      backdraw: matches.filter(m => m.bracket_type === 'backdraw'),
      group: matches.filter(m => m.bracket_type === 'group')
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
