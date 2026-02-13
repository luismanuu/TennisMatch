import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { validateAndSetMatchScheduling } from '~/server/utils/tournament-scheduling'
import { createMatchNotification } from '~/server/utils/notifications'
import { datetimeLocalToISO, isDateInPast } from '~/server/utils/timezone'
import { validateBody, createMatchCreateBodySchema } from '~/server/utils/validation'
import type { CreateMatchPayload } from '~/types'
import { ValidationError, ForbiddenError, InternalServerError, handleApiError } from '~/server/utils/errors'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate request body with Zod
    const validatedBody = validateBody(createMatchCreateBodySchema, body)
    const {
      clerk_id,
      player1_id,
      player2_id,
      pending_player2_id,
      scheduled_at,
      location,
      is_competitive,
      tournament_id,
    } = validatedBody
    
    // Convert datetime-local to ISO (treating input as Ecuador time)
    let scheduledAtISO: string
    try {
      scheduledAtISO = datetimeLocalToISO(scheduled_at)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid date'
      throw new ValidationError(`Invalid date format: ${message}`)
    }
    
    // Validate scheduled_at is not in the past
    if (isDateInPast(scheduledAtISO)) {
      throw new ValidationError('Cannot schedule a match in the past')
    }
    
    // Check if this is a tournament match and validate round deadline
    // Note: tournament_id will be set when bracket is generated, so we check after match creation
    
    // Note: Validation of player2_id vs pending_player2_id is handled by Zod schema
    
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
      throw new ForbiddenError('player1_id does not match authenticated user', { player1_id })
    }
    
    // If player2_id is provided, verify it exists
    if (player2_id) {
      const { data: player2, error: player2Error } = await supabase
        .from('players')
        .select('id')
        .eq('id', player2_id)
        .single()
      
      if (player2Error || !player2) {
        throw new ValidationError('Invalid player2_id', { player2_id })
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
          logger.error('Error fetching matches as player1', matchesAsPlayer1.error, { player1_id })
        }
        if (matchesAsPlayer2.error) {
          logger.error('Error fetching matches as player2', matchesAsPlayer2.error, { player2_id })
        }
        
        // If there are errors, don't block match creation but log them
        // Only validate if queries succeeded
        if (!matchesAsPlayer1.error && !matchesAsPlayer2.error) {
          const monthlyMatches = [
            ...(matchesAsPlayer1.data || []),
            ...(matchesAsPlayer2.data || [])
          ]
          
          if (monthlyMatches.length >= 4) {
            throw new ValidationError('No puedes programar más de 4 partidos competitivos con el mismo jugador en un mes. Puedes programar un partido amistoso en su lugar.', { player1_id, player2_id })
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
        throw new ValidationError('Invalid pending_player2_id', { pending_player2_id })
      }
      
      // Verify the pending player was invited by the current user
      if (pendingPlayer.invited_by_player_id !== player1_id) {
        throw new ForbiddenError('Pending player was not invited by you', { pending_player2_id, player1_id })
      }
    }
    
    // Create the match with status 'scheduled'
    // is_competitive defaults to true if not specified
    // match_proposed_by is set to player1 (the creator) UNLESS it's a tournament match
    // Tournament matches don't require acceptance - they're assigned by admin/organizer
    
    // scheduledAtISO is already converted above using datetimeLocalToISO
    const matchData: Record<string, unknown> = {
      player1_id,
      scheduled_at: scheduledAtISO,
      status: 'scheduled',
      location: location || null,
      is_competitive: is_competitive !== undefined ? is_competitive : true
    }
    
    // Only set match_proposed_by for non-tournament matches
    // Tournament matches are assigned by admin/organizer and don't need acceptance
    if (!tournament_id) {
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
      throw new InternalServerError('Failed to create match', { matchInsertError })
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
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/matches')
  }
})

