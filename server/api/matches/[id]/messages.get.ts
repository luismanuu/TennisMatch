import { and, asc, eq, sql } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { match_messages, matches, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const matchId = getRouterParam(event, 'id')
    const query = getQuery(event)
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    const db = useDb()
    
    // Get current player
    const currentPlayer = await db.query.players.findFirst({
      columns: { id: true },
      where: eq(players.user_id, user.id),
    })
    
    if (!currentPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Player not found'
      })
    }
    
    // Verify match exists and user is part of it or is organizer
    const match = await db.query.matches.findFirst({
      columns: { player1_id: true, player2_id: true, pending_player2_id: true, tournament_id: true },
      with: {
        pending_player2: { columns: { id: true, invited_by_player_id: true } },
        tournament: { columns: { id: true, organizer_id: true, created_by: true } },
      },
      where: eq(matches.id, matchId),
    })
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Verify user is part of the match
    const isPlayer1 = match.player1_id === currentPlayer.id
    const isPlayer2 = match.player2_id === currentPlayer.id
    const isPendingPlayerInviter = match.pending_player2_id &&
      match.pending_player2?.invited_by_player_id === currentPlayer.id
    
    // Admins can act on any match
    const isAdmin = user.role === 'admin'
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id && match.tournament) {
      try {
        await verifyOrganizerOwnsTournament(currentPlayer.id, match.tournament_id)
        isTournamentOrganizer = true
      } catch (err) {
        // Not organizer of this tournament
        isTournamentOrganizer = false
      }
    }
    
    // Admins can view chat of any match
    if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter && !isTournamentOrganizer && !isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not part of this match or organizer of the tournament'
      })
    }
    
    // Fetch messages (optionally filter by since timestamp for incremental updates)
    const since = query.since as string | undefined
    const messages = await db.query.match_messages.findMany({
      where: and(
        eq(match_messages.match_id, matchId),
        // If since parameter is provided, only fetch messages after that timestamp. The API serialises
        // created_at with millisecond precision, so compare at that precision or the last message repeats.
        since
          ? sql`date_trunc('milliseconds', ${match_messages.created_at}) > ${new Date(since).toISOString()}::timestamptz`
          : undefined
      ),
      with: { player: { columns: { id: true, name: true } } },
      orderBy: [asc(match_messages.created_at)],
    })
    
    return messages
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

