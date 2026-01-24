import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { validateAndSetMatchScheduling } from '~/server/utils/tournament-scheduling'
import { createMatchNotification } from '~/server/utils/notifications'
import { datetimeLocalToISO, isDateInPast } from '~/server/utils/timezone'
import type { CreateMatchPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateMatchPayload & { clerk_id: string }>(event)
    const { clerk_id, player1_id, player2_id, pending_player2_id, scheduled_at, location, is_competitive } = body
    
    if (!clerk_id || !player1_id || !scheduled_at) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, player1_id, scheduled_at'
      })
    }
    
    // Convert datetime-local to ISO (treating input as Ecuador time)
    let scheduledAtISO: string
    try {
      scheduledAtISO = datetimeLocalToISO(scheduled_at)
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid date format: ${error.message}`
      })
    }
    
    // Validate scheduled_at is not in the past
    if (isDateInPast(scheduledAtISO)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot schedule a match in the past'
      })
    }
    
    // Check if this is a tournament match and validate round deadline
    // Note: tournament_id will be set when bracket is generated, so we check after match creation
    
    // Validate that either player2_id or pending_player2_id is provided, but not both
    if (!player2_id && !pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Either player2_id or pending_player2_id must be provided'
      })
    }
    
    if (player2_id && pending_player2_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot provide both player2_id and pending_player2_id'
      })
    }
    
    // Verify Clerk user exists
    await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Verify player1 exists and belongs to the authenticated user
    const { data: player1, error: player1Error } = await supabase
      .from('players')
      .select('id, clerk_id')
      .eq('id', player1_id)
      .eq('clerk_id', clerk_id)
      .single()
    
    if (player1Error || !player1) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: player1_id does not match authenticated user'
      })
    }
    
    // If player2_id is provided, verify it exists
    if (player2_id) {
      const { data: player2, error: player2Error } = await supabase
        .from('players')
        .select('id')
        .eq('id', player2_id)
        .single()
      
      if (player2Error || !player2) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid player2_id'
        })
      }
      
      // Validate: if competitive match, check if players already played 4+ times this month
      // Only apply this restriction to competitive matches, friendly matches are allowed
      const isCompetitive = is_competitive !== undefined ? is_competitive : true
      if (isCompetitive) {
        // Calculate date boundaries for current month
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        
        // Fetch all competitive completed matches between these two players this month
        const [matchesAsPlayer1, matchesAsPlayer2] = await Promise.all([
          supabase
            .from('matches')
            .select('id')
            .eq('status', 'completed')
            .eq('is_competitive', true)
            .eq('player1_id', player1_id)
            .eq('player2_id', player2_id)
            .gte('played_at', firstDayOfMonth.toISOString())
            .lt('played_at', firstDayOfNextMonth.toISOString()),
          supabase
            .from('matches')
            .select('id')
            .eq('status', 'completed')
            .eq('is_competitive', true)
            .eq('player1_id', player2_id)
            .eq('player2_id', player1_id)
            .gte('played_at', firstDayOfMonth.toISOString())
            .lt('played_at', firstDayOfNextMonth.toISOString())
        ])
        
        // Check for errors in queries
        if (matchesAsPlayer1.error) {
          console.error('Error fetching matches as player1:', matchesAsPlayer1.error)
        }
        if (matchesAsPlayer2.error) {
          console.error('Error fetching matches as player2:', matchesAsPlayer2.error)
        }
        
        // If there are errors, don't block match creation but log them
        // Only validate if queries succeeded
        if (!matchesAsPlayer1.error && !matchesAsPlayer2.error) {
          const monthlyMatches = [
            ...(matchesAsPlayer1.data || []),
            ...(matchesAsPlayer2.data || [])
          ]
          
          if (monthlyMatches.length >= 4) {
            throw createError({
              statusCode: 400,
              statusMessage: 'No puedes programar más de 4 partidos competitivos con el mismo jugador en un mes. Puedes programar un partido amistoso en su lugar.'
            })
          }
        }
      }
    }
    
    // If pending_player2_id is provided, verify it exists
    if (pending_player2_id) {
      const { data: pendingPlayer, error: pendingPlayerError } = await supabase
        .from('pending_players')
        .select('id, invited_by_player_id, status')
        .eq('id', pending_player2_id)
        .single()
      
      if (pendingPlayerError || !pendingPlayer) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid pending_player2_id'
        })
      }
      
      // Verify the pending player was invited by the current user
      if (pendingPlayer.invited_by_player_id !== player1_id) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: pending player was not invited by you'
        })
      }
    }
    
    // Create the match with status 'scheduled'
    // is_competitive defaults to true if not specified
    // match_proposed_by is set to player1 (the creator) UNLESS it's a tournament match
    // Tournament matches don't require acceptance - they're assigned by admin/organizer
    
    // scheduledAtISO is already converted above using datetimeLocalToISO
    const matchData: any = {
      player1_id,
      scheduled_at: scheduledAtISO,
      status: 'scheduled',
      location: location || null,
      is_competitive: is_competitive !== undefined ? is_competitive : true
    }
    
    // Only set match_proposed_by for non-tournament matches
    // Tournament matches are assigned by admin/organizer and don't need acceptance
    const bodyWithTournament = body as CreateMatchPayload & { clerk_id: string; tournament_id?: string }
    if (!bodyWithTournament.tournament_id) {
      matchData.match_proposed_by = player1_id // The creator proposes the match
    }
    
    if (player2_id) {
      matchData.player2_id = player2_id
    } else {
      matchData.pending_player2_id = pending_player2_id
    }
    
    const { data: match, error: matchInsertError } = await supabase
      .from('matches')
      .insert(matchData)
      .select(`
        *,
        player1:players!matches_player1_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!matches_player2_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status
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
        winner:players!matches_winner_id_fkey(
          id,
          name
        )
      `)
      .single()
    
    if (matchInsertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create match',
        data: matchInsertError
      })
    }
    
    // If this is a tournament match, validate round deadline
    if (match.tournament_id) {
      await validateAndSetMatchScheduling(match.id, scheduled_at, supabase)
    }
    
    // Create notifications for both players
    // For non-tournament matches: player2 gets proposal notification, player1 gets created notification
    // For tournament matches: both get created notification (no proposal needed)
    if (player2_id) {
      if (match.match_proposed_by) {
        // Non-tournament match: notify player2 they have a proposal to accept
        await createMatchNotification(
          supabase,
          player2_id,
          match.id,
          'match_proposal',
          { 
            proposed_by: match.player1?.name || 'Unknown',
            scheduled_at: match.scheduled_at,
            location: match.location
          }
        )
        
        // Notify player1 that match was created (informational)
        await createMatchNotification(
          supabase,
          player1_id,
          match.id,
          'match_created',
          { 
            with_player: match.player2?.name || 'Unknown',
            scheduled_at: match.scheduled_at
          }
        )
      } else {
        // Tournament match: notify both players that match is confirmed
        await Promise.all([
          createMatchNotification(
            supabase,
            player1_id,
            match.id,
            'match_created',
            { 
              with_player: match.player2?.name || 'Unknown',
              scheduled_at: match.scheduled_at,
              is_tournament: true
            }
          ),
          createMatchNotification(
            supabase,
            player2_id,
            match.id,
            'match_created',
            { 
              with_player: match.player1?.name || 'Unknown',
              scheduled_at: match.scheduled_at,
              is_tournament: true
            }
          )
        ])
      }
    } else if (pending_player2_id) {
      // Match with pending player: notify player1 that match was created
      await createMatchNotification(
        supabase,
        player1_id,
        match.id,
        'match_created',
        { 
          with_player: match.pending_player2?.name || 'Unknown',
          is_pending_player: true,
          scheduled_at: match.scheduled_at
        }
      )
    }
    
    return match
  } catch (error: any) {
    console.error('Error in matches POST endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

