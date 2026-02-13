import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { checkIsAdmin } from '~/server/utils/admin'
import { createMatchMessageBodySchema, matchIdSchema, validateBody, validateParam } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const matchId = validateParam(matchIdSchema, getRouterParam(event, 'id'))

    const body = validateBody(createMatchMessageBodySchema, await readBody(event))
    const clerk_id = body.clerk_id
    const message = body.message.trim()
    
    // Verify Clerk user exists
    await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Get current player
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
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
    const isAdmin = await checkIsAdmin(clerk_id)
    
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
    
    // Admins can send messages to any match
    if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter && !isTournamentOrganizer && !isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not part of this match or organizer of the tournament'
      })
    }
    
    // Create message
    const { data: newMessage, error: insertError } = await supabase
      .from('match_messages')
      .insert({
        match_id: matchId,
        player_id: currentPlayer.id,
        message
      })
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
      .single()
    
    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create message',
        data: insertError,
      })
    }
    
    return newMessage
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/matches/[id]/messages')
  }
})

