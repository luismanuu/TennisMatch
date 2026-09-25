import { asc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { match_messages, matches, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'

const namedPlayer = { columns: { id: true, name: true } } as const
const categoryColumns = { columns: { id: true, name: true, description: true, order: true } } as const
const seatedPlayer = {
  columns: {
    id: true,
    name: true,
    user_id: true,
    status: true,
    elo: true,
    total_matches_played: true,
    placement_matches_completed: true,
    phone_number: true,
  },
  with: { category: categoryColumns },
} as const

// The nested keys the match page reads
const matchDetailRelations = {
  player1: seatedPlayer,
  player2: seatedPlayer,
  pending_player2: {
    columns: { id: true, name: true, email: true, status: true, invited_by_player_id: true },
    with: { category: categoryColumns },
  },
  match_proposed_by_player: namedPlayer,
  match_accepted_by_player: namedPlayer,
  match_rejected_by_player: namedPlayer,
  acceptance_change_approved_by_player: namedPlayer,
  acceptance_change_rejected_by_player: namedPlayer,
  score_proposed_by_player: namedPlayer,
  score_approved_by_player: namedPlayer,
  schedule_proposed_by_player: namedPlayer,
  schedule_approved_by_player: namedPlayer,
  schedule_rejected_by_player: namedPlayer,
  reschedule_proposed_by_player: namedPlayer,
  reschedule_approved_by_player: namedPlayer,
  reschedule_rejected_by_player: namedPlayer,
  winner: namedPlayer,
  tournament: { columns: { id: true, name: true, category_id: true, organizer_id: true, created_by: true } },
  tournament_match: {
    columns: { id: true, bracket_type: true, round_number: true, group_id: true, round_deadline: true },
    with: { group: { columns: { id: true, group_name: true } } },
  },
} as const

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const matchId = getRouterParam(event, 'id')
    
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
    
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: matchDetailRelations,
    })
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Admins can act on any match
    const isAdmin = user.role === 'admin'
    
    // Verify user is part of the match OR is organizer of the tournament OR is admin
    const isPlayer1 = match.player1_id === currentPlayer.id
    const isPlayer2 = match.player2_id === currentPlayer.id
    const isPendingPlayerInviter = match.pending_player2_id &&
      match.pending_player2?.invited_by_player_id === currentPlayer.id
    const isTournamentOrganizer = !!match.tournament &&
      (match.tournament.organizer_id === currentPlayer.id || match.tournament.created_by === currentPlayer.id)
    
    if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter && !isTournamentOrganizer && !isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not part of this match or organizer of the tournament'
      })
    }
    
    const messages = await db.query.match_messages.findMany({
      where: eq(match_messages.match_id, matchId),
      with: { player: { columns: { id: true, name: true, user_id: true } } },
      orderBy: [asc(match_messages.created_at)],
    })
    
    // tournament_match stays an array (empty for a friendly), as the API has always returned it.
    return {
      ...match,
      messages
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
