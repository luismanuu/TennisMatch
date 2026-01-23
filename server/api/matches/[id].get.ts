import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkIsAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const matchId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const clerk_id = query.clerk_id as string
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }
    
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
    
    // First, fetch match with basic relations to verify it exists
    // Use optional foreign keys (with ?) for schedule fields in case they don't have FK constraints
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:players!matches_player1_id_fkey(
          id,
          name,
          clerk_id,
          status,
          elo,
          total_matches_played,
          placement_matches_completed,
          category:categories(id, name, description, order)
        ),
        player2:players!matches_player2_id_fkey(
          id,
          name,
          clerk_id,
          status,
          elo,
          total_matches_played,
          placement_matches_completed,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status,
          invited_by_player_id
        ),
        match_proposed_by_player:players!matches_match_proposed_by_fkey(
          id,
          name
        ),
        match_accepted_by_player:players!matches_match_accepted_by_fkey(
          id,
          name
        ),
        match_rejected_by_player:players!matches_match_rejected_by_fkey(
          id,
          name
        ),
        acceptance_change_approved_by_player:players!matches_acceptance_change_approved_by_fkey(
          id,
          name
        ),
        acceptance_change_rejected_by_player:players!matches_acceptance_change_rejected_by_fkey(
          id,
          name
        ),
        score_proposed_by_player:players!matches_score_proposed_by_fkey(
          id,
          name
        ),
        score_approved_by_player:players!matches_score_approved_by_fkey(
          id,
          name
        ),
        reschedule_proposed_by_player:players!matches_reschedule_proposed_by_fkey(
          id,
          name
        ),
        reschedule_approved_by_player:players!matches_reschedule_approved_by_fkey(
          id,
          name
        ),
        reschedule_rejected_by_player:players!matches_reschedule_rejected_by_fkey(
          id,
          name
        ),
        winner:players!matches_winner_id_fkey(
          id,
          name
        ),
        tournament:tournaments(
          id,
          name,
          category_id,
          organizer_id,
          created_by
        ),
        tournament_match:tournament_matches(
          id,
          bracket_type,
          round_number,
          group_id,
          round_deadline,
          group:tournament_groups(
            id,
            group_name
          )
        )
      `)
      .eq('id', matchId)
      .single()
    
    if (matchError) {
      // Log the error for debugging
      console.error('Match fetch error:', matchError)
      // Try a simpler query without optional relations
      const { data: simpleMatch, error: simpleError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()
      
      if (simpleError || !simpleMatch) {
        throw createError({
          statusCode: 404,
          statusMessage: `Match not found: ${matchError.message || simpleError?.message || 'Unknown error'}`
        })
      }
      
      // If simple query works, the match exists but there's an issue with relations
      // Return the match without the problematic relations
      throw createError({
        statusCode: 500,
        statusMessage: `Error loading match relations: ${matchError.message}`
      })
    }
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Check if user is admin (admins can view any match)
    const isAdmin = await checkIsAdmin(clerk_id)
    
    // Verify user is part of the match OR is organizer of the tournament OR is admin
    const isPlayer1 = match.player1_id === currentPlayer.id
    const isPlayer2 = match.player2_id === currentPlayer.id
    const isPendingPlayerInviter = match.pending_player2_id && 
      (match.pending_player2 as any)?.invited_by_player_id === currentPlayer.id
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id) {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('organizer_id, created_by')
        .eq('id', match.tournament_id)
        .single()
      
      if (!tournamentError && tournament) {
        isTournamentOrganizer = tournament.organizer_id === currentPlayer.id || 
                                tournament.created_by === currentPlayer.id
      }
    }
    
    if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter && !isTournamentOrganizer && !isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not part of this match or organizer of the tournament'
      })
    }
    
    // Fetch messages for this match
    const { data: messages, error: messagesError } = await supabase
      .from('match_messages')
      .select(`
        *,
        player:players(
          id,
          name,
          clerk_id
        )
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    
    if (messagesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch messages',
        data: messagesError
      })
    }
    
    // Fetch schedule-related players separately if needed (in case FK constraints don't exist)
    if ((match as any).schedule_proposed_by) {
      const { data: scheduleProposer } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (match as any).schedule_proposed_by)
        .single()
      if (scheduleProposer) {
        (match as any).schedule_proposed_by_player = scheduleProposer
      }
    }
    
    if ((match as any).schedule_approved_by) {
      const { data: scheduleApprover } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (match as any).schedule_approved_by)
        .single()
      if (scheduleApprover) {
        (match as any).schedule_approved_by_player = scheduleApprover
      }
    }
    
    if ((match as any).schedule_rejected_by) {
      const { data: scheduleRejecter } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (match as any).schedule_rejected_by)
        .single()
      if (scheduleRejecter) {
        (match as any).schedule_rejected_by_player = scheduleRejecter
      }
    }
    
    // Flatten tournament_match if it exists
    const enrichedMatch: any = { ...match }
    if (match.tournament_match && Array.isArray(match.tournament_match) && match.tournament_match.length > 0) {
      enrichedMatch.tournament_match = match.tournament_match[0]
    } else if (match.tournament_match && !Array.isArray(match.tournament_match)) {
      enrichedMatch.tournament_match = match.tournament_match
    }
    
    return {
      ...enrichedMatch,
      messages: messages || []
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

