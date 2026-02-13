import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { checkIsAdmin } from '~/server/utils/admin'
import { matchIdSchema, matchMessagesQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const matchId = validateQuery(matchIdSchema, getRouterParam(event, 'id'))
    const query = validateQuery(matchMessagesQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const since = query.since
    const limit = query.limit ?? 200
    
    // Verify Clerk user exists
    await getClerkUser(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Get current player
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()
    
    if (playerError || !currentPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Player not found'
      })
    }
    
    // Verify match exists and user is part of it or is organizer
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        player1_id, 
        player2_id, 
        pending_player2_id, 
        tournament_id,
        pending_player2:pending_players(id, invited_by_player_id),
        tournament:tournaments(id)
      `)
      .eq('id', matchId)
      .single()
    
    if (matchError || !match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Verify user is part of the match
    const isPlayer1 = match.player1_id === currentPlayer.id
    const isPlayer2 = match.player2_id === currentPlayer.id
    const invitedByPlayerId = (
      match as unknown as { pending_player2?: { invited_by_player_id?: string | null } | null }
    ).pending_player2?.invited_by_player_id
    const isPendingPlayerInviter = Boolean(match.pending_player2_id) && invitedByPlayerId === currentPlayer.id
    
    // Check if user is admin
    const isAdmin = await checkIsAdmin(clerkId)
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id && match.tournament) {
      try {
        await verifyOrganizerOwnsTournament(currentPlayer.id, match.tournament_id, supabase)
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
    let queryBuilder = supabase
      .from('match_messages')
      .select(`
        id,
        match_id,
        player_id,
        message,
        created_at,
        player:players(
          id,
          name,
          clerk_id
        )
      `)
      .eq('match_id', matchId)
    
    // If since parameter is provided, only fetch messages after that timestamp
    if (since) {
      queryBuilder = queryBuilder.gt('created_at', since)
    }
    
    // For initial load (no since): fetch last N messages (DESC) then reverse for UI
    // For incremental load: fetch ASC after `since` so appending preserves order
    const { data: messages, error: messagesError } = await (since
      ? queryBuilder.order('created_at', { ascending: true }).limit(limit)
      : queryBuilder.order('created_at', { ascending: false }).limit(limit))
    
    if (messagesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch messages',
        data: messagesError
      })
    }
    
    const rows = messages || []
    return since ? rows : rows.slice().reverse()
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/matches/[id]/messages')
  }
})

