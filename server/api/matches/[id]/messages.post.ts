import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import type { CreateMatchMessagePayload } from '~/types'

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
    
    const body = await readBody<CreateMatchMessagePayload>(event)
    const { message } = body
    
    if (!message || !message.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'message is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Get current player
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
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
        tournament:tournaments(id, organizer_id, created_by)
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
    const isPendingPlayerInviter = match.pending_player2_id && 
      (match.pending_player2 as any)?.invited_by_player_id === currentPlayer.id
    
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
        message: message.trim()
      })
      .select(`
        *,
        player:players(
          id,
          name,
          user_id
        )
      `)
      .single()
    
    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create message',
        data: insertError
      })
    }
    
    return newMessage
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

