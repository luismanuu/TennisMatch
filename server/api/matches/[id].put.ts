import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkIsOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { checkIsAdmin } from '~/server/utils/admin'
import { updateBracketAfterMatch, recalculateGroupStandings } from '~/server/utils/tournament-brackets'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { createMatchNotification, dismissExistingNotifications } from '~/server/utils/notifications'
import { validateBody, validateParam, matchUpdateBodySchema, matchIdSchema } from '~/server/utils/validation'
import { ValidationError, NotFoundError } from '~/server/utils/errors'
import { logger } from '~/server/utils/logger'
import { applyMatchAction } from '~/server/services/matches/apply-match-action'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export default defineEventHandler(async (event) => {
  try {
    const matchIdParam = getRouterParam(event, 'id')
    
    // Validate match ID
    const matchId = validateParam(matchIdSchema, matchIdParam)
    
    const body = await readBody(event)
    
    // Validate request body with Zod
    const validatedBody = validateBody(matchUpdateBodySchema, body)
    const { clerk_id, action, data } = validatedBody
    
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
    
    // Fetch match to verify user is part of it or is organizer
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        pending_player2:pending_players(
          id,
          status,
          invited_by_player_id
        ),
        tournament:tournaments(
          id,
          organizer_id,
          created_by
        )
      `)
      .eq('id', matchId)
      .single()
    
    if (matchError || !match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id && match.tournament) {
      const clerkUser = await getClerkUser(clerk_id)
      const role = clerkUser.publicMetadata?.role as string | undefined
      if (role === 'tournament_organizer') {
        try {
          await verifyOrganizerOwnsTournament(currentPlayer.id, match.tournament_id, supabase)
          isTournamentOrganizer = true
        } catch (err) {
          // Not organizer of this tournament
          isTournamentOrganizer = false
        }
      }
    }
    
    // Check if user is admin
    const isAdmin = await checkIsAdmin(clerk_id)
    
    // Verify user is part of the match (unless they're organizer and action is organizer-specific, or admin)
    if (action !== 'organizer_set_result' && !isAdmin) {
      const isPlayer1 = match.player1_id === currentPlayer.id
      const isPlayer2 = match.player2_id === currentPlayer.id
      const isPendingPlayerInviter = match.pending_player2_id && 
        (asRecord(match.pending_player2)?.['invited_by_player_id'] === currentPlayer.id)
      
      if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: You are not part of this match'
        })
      }
    } else if (body.action === 'organizer_set_result' && !isTournamentOrganizer && !isAdmin) {
      // For organizer actions, verify they are organizer or admin
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: Only tournament organizers or admins can perform this action'
      })
    }
    
    const { updateData, pendingNotifications, dismissNotifications } = await applyMatchAction({
      action,
      data,
      match,
      matchId,
      currentPlayerId: currentPlayer.id,
      isAdmin,
      supabase
    })
    
    // Update the match
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId)
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
        )
      `)
      .single()
    
    if (updateError) {
      logger.error('Update match error', updateError, { matchId, action, updateData })
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update match: ${updateError.message || 'Unknown error'}. ${updateError.details || ''}`,
        data: updateError
      })
    }
    
    if (!updatedMatch) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found after update'
      })
    }
    
    // Process pending notifications (create new ones)
    for (const notification of pendingNotifications) {
      await createMatchNotification(
        supabase,
        notification.playerId,
        matchId,
        notification.type,
        notification.metadata
      )
    }
    
    // Process dismiss notifications (auto-dismiss when action is taken)
    for (const dismiss of dismissNotifications) {
      await dismissExistingNotifications(
        supabase,
        dismiss.playerId,
        matchId,
        dismiss.types
      )
    }
    
    // Fetch schedule-related players separately if needed (in case FK constraints don't exist)
    const updatedMatchRecord = asRecord(updatedMatch)
    const scheduleProposedBy =
      updatedMatchRecord && typeof updatedMatchRecord['schedule_proposed_by'] === 'string'
        ? (updatedMatchRecord['schedule_proposed_by'] as string)
        : null
    if (scheduleProposedBy) {
      const { data: scheduleProposer } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', scheduleProposedBy)
        .single()
      if (scheduleProposer) {
        ;(updatedMatch as Record<string, unknown>)['schedule_proposed_by_player'] = scheduleProposer
      }
    }
    
    const scheduleApprovedBy =
      updatedMatchRecord && typeof updatedMatchRecord['schedule_approved_by'] === 'string'
        ? (updatedMatchRecord['schedule_approved_by'] as string)
        : null
    if (scheduleApprovedBy) {
      const { data: scheduleApprover } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', scheduleApprovedBy)
        .single()
      if (scheduleApprover) {
        ;(updatedMatch as Record<string, unknown>)['schedule_approved_by_player'] = scheduleApprover
      }
    }
    
    const scheduleRejectedBy =
      updatedMatchRecord && typeof updatedMatchRecord['schedule_rejected_by'] === 'string'
        ? (updatedMatchRecord['schedule_rejected_by'] as string)
        : null
    if (scheduleRejectedBy) {
      const { data: scheduleRejecter } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', scheduleRejectedBy)
        .single()
      if (scheduleRejecter) {
        ;(updatedMatch as Record<string, unknown>)['schedule_rejected_by_player'] = scheduleRejecter
      }
    }
    
    // If match was completed and belongs to a tournament, update bracket and standings
    if (updatedMatch.status === 'completed' && updatedMatch.winner_id && updatedMatch.tournament_id) {
      logger.debug('Match completed, checking if tournament match', { matchId })
      try {
        // Get tournament match info to check if it's a group stage match
        const { data: tournamentMatch } = await supabase
          .from('tournament_matches')
          .select('tournament_id, bracket_type, group_id')
          .eq('match_id', matchId)
          .single()

        if (tournamentMatch) {
          logger.debug('Tournament match found, calling updateBracketAfterMatch', { matchId, bracket_type: tournamentMatch.bracket_type })
          // Update bracket progression
          await updateBracketAfterMatch(matchId, updatedMatch.winner_id, supabase)
          logger.debug('updateBracketAfterMatch completed', { matchId })

          // If it's a group stage match, recalculate standings
          if (tournamentMatch.bracket_type === 'group' && tournamentMatch.group_id) {
            try {
              await recalculateGroupStandings(
                tournamentMatch.tournament_id,
                tournamentMatch.group_id,
                supabase
              )
            } catch (standingsError) {
              // Log error but don't fail the request
              logger.error('Error recalculating standings after match', standingsError, { matchId, tournamentId: match.tournament_id })
            }
          }
        }
      } catch (bracketError) {
        // Log error but don't fail the request
        logger.error('Error updating bracket after match', bracketError, { matchId, tournamentId: match.tournament_id })
      }
    }
    
    // Update player ratings after match completion (for ALL matches - tournament and regular)
    // Execute asynchronously in background to avoid blocking the response
    if (updatedMatch.status === 'completed' && updatedMatch.winner_id && updatedMatch.player1_id && updatedMatch.player2_id) {
      logger.debug('Match completed, updating player ratings asynchronously', { matchId })
      // Execute in background without blocking the response
      updateRatingsAfterMatch(matchId, supabase)
        .then((ratingResult) => {
          if (ratingResult) {
            logger.info('Ratings updated', {
              matchId,
              player1_elo_change: ratingResult.player1.eloChange,
              player2_elo_change: ratingResult.player2.eloChange
            })
          } else {
            logger.warn('Rating update returned null', { matchId })
          }
        })
        .catch((ratingError) => {
          // Log error but don't fail the request - ratings are important but not critical to match flow
          logger.error('Error updating ratings after match', ratingError, { matchId })
        })
    }
    
    return updatedMatch
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/matches/[id]')
  }
})

