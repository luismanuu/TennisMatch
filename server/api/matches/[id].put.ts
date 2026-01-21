import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkIsOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { updateBracketAfterMatch, recalculateGroupStandings } from '~/server/utils/tournament-brackets'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { createMatchNotification, dismissExistingNotifications } from '~/server/utils/notifications'
import { datetimeLocalToISO, isDateInFuture } from '~/server/utils/timezone'
import type { ProposeScorePayload, ApproveScorePayload, UpdateMatchStatusPayload, ProposeReschedulePayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const matchId = getRouterParam(event, 'id')
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    const body = await readBody<{
      clerk_id: string
      action: 'update_status' | 'propose_score' | 'approve_score' | 'reject_score' | 'cancel' | 'accept_match' | 'reject_match' | 'propose_schedule' | 'approve_schedule' | 'reject_schedule' | 'propose_reschedule' | 'approve_reschedule' | 'reject_reschedule' | 'approve_acceptance_change' | 'reject_acceptance_change' | 'organizer_set_result'
      data?: UpdateMatchStatusPayload | ProposeScorePayload | ApproveScorePayload | ProposeReschedulePayload | { score?: string, winner_id: string, is_wo?: boolean } | { scheduled_at?: string, location?: string }
    }>(event)
    
    const { clerk_id, action, data } = body
    
    if (!clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
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
    
    // Verify user is part of the match (unless they're organizer and action is organizer-specific)
    if (body.action !== 'organizer_set_result') {
      const isPlayer1 = match.player1_id === currentPlayer.id
      const isPlayer2 = match.player2_id === currentPlayer.id
      const isPendingPlayerInviter = match.pending_player2_id && 
        (match.pending_player2 as any)?.invited_by_player_id === currentPlayer.id
      
      if (!isPlayer1 && !isPlayer2 && !isPendingPlayerInviter) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: You are not part of this match'
        })
      }
    } else {
      // For organizer actions, verify they are organizer
      if (!isTournamentOrganizer) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Unauthorized: Only tournament organizers can perform this action'
        })
      }
    }
    
    let updateData: any = {}
    
    // Track notifications to create after match update
    const pendingNotifications: Array<{
      playerId: string
      type: 'match_proposal' | 'match_created' | 'score_proposal' | 'schedule_proposal' | 'reschedule_proposal' | 'acceptance_change'
      metadata?: Record<string, any>
    }> = []
    
    // Track notifications to dismiss after match update
    const dismissNotifications: Array<{
      playerId: string
      types: Array<'match_proposal' | 'match_created' | 'score_proposal' | 'schedule_proposal' | 'reschedule_proposal' | 'acceptance_change'>
    }> = []
    
    switch (action) {
      case 'update_status': {
        const statusData = data as UpdateMatchStatusPayload
        if (!statusData?.status) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Status is required'
          })
        }
        
        // Validate status transition
        if (statusData.status === 'active' && match.status === 'scheduled') {
          // Cannot activate if opponent is pending
          if (match.pending_player2_id && (match.pending_player2 as any)?.status === 'pending') {
            throw createError({
              statusCode: 400,
              statusMessage: 'Cannot activate match: opponent is still pending registration'
            })
          }
          // Cannot activate if no opponent
          if (!match.player2_id && !match.pending_player2_id) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Cannot activate match: no opponent set'
            })
          }
          // Cannot activate if match has not been accepted by player2
          // Exception: Tournament matches don't require acceptance (they're assigned by admin/organizer)
          if (match.match_proposed_by && !match.match_accepted_by && !match.tournament_id) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Cannot activate match: opponent has not accepted the match yet'
            })
          }
          // Cannot activate if there are pending acceptance changes that haven't been approved
          if ((match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Cannot activate match: pending acceptance change proposal must be approved or rejected first'
            })
          }
        }
        
        updateData.status = statusData.status
        break
      }
      
      case 'propose_score': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Score can only be proposed when match status is active'
          })
        }
        
        const scoreData = data as ProposeScorePayload
        if (!scoreData?.score || !scoreData?.winner_id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Score and winner_id are required'
          })
        }
        
        // Validate winner is one of the players
        if (scoreData.winner_id !== match.player1_id && scoreData.winner_id !== match.player2_id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Winner must be one of the match players'
          })
        }
        
        updateData.score = scoreData.score
        updateData.winner_id = scoreData.winner_id
        updateData.score_proposed_by = currentPlayer.id
        updateData.score_proposed_at = new Date().toISOString()
        
        // Notify opponent about score proposal (after update completes)
        const opponentId = match.player1_id === currentPlayer.id ? match.player2_id : match.player1_id
        if (opponentId) {
          // Will create notification after match update
          pendingNotifications.push({
            playerId: opponentId,
            type: 'score_proposal',
            metadata: {
              proposed_by: currentPlayer.id,
              score: scoreData.score,
              winner_id: scoreData.winner_id
            }
          })
        }
        break
      }
      
      case 'approve_score': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Score can only be approved when match status is active'
          })
        }
        
        if (!match.score_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No score has been proposed yet'
          })
        }
        
        // Cannot approve your own score proposal
        if (match.score_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot approve your own score proposal'
          })
        }
        
        updateData.score_approved_by = currentPlayer.id
        updateData.status = 'completed'
        updateData.played_at = new Date().toISOString()
        
        // Dismiss score proposal notifications for both players
        if (match.player1_id) {
          dismissNotifications.push({
            playerId: match.player1_id,
            types: ['score_proposal']
          })
        }
        if (match.player2_id) {
          dismissNotifications.push({
            playerId: match.player2_id,
            types: ['score_proposal']
          })
        }
        break
      }
      
      case 'reject_score': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Score can only be rejected when match status is active'
          })
        }
        
        if (!match.score_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No score has been proposed yet'
          })
        }
        
        // Cannot reject your own score proposal
        if (match.score_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot reject your own score proposal'
          })
        }
        
        // Clear the proposed score (dispute resolution is future feature)
        updateData.score = null
        updateData.winner_id = null
        updateData.score_proposed_by = null
        updateData.score_proposed_at = null
        break
      }
      
      case 'cancel': {
        if (match.status === 'completed') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Cannot cancel a completed match'
          })
        }
        
        if (match.status === 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Cannot cancel an active match. Use reschedule instead.'
          })
        }
        
        updateData.status = 'cancelled'
        break
      }
      
      case 'accept_match': {
        // Only player2 can accept the match (player1 proposed it)
        if (match.player1_id === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot accept your own match proposal'
          })
        }
        
        // Must be player2
        if (match.player2_id !== currentPlayer.id) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the opponent can accept the match'
          })
        }
        
        // Check if match was already accepted or rejected
        if (match.match_accepted_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has already been accepted'
          })
        }
        
        if (match.match_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has already been rejected'
          })
        }
        
        // Check if match was proposed
        if (!match.match_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has not been proposed yet'
          })
        }
        
        // Accept the match
        updateData.match_accepted_by = currentPlayer.id
        
        // If player2 provided alternative schedule/location, store it as a proposal
        const acceptanceData = data as { scheduled_at?: string, location?: string } | undefined
        if (acceptanceData) {
          if (acceptanceData.scheduled_at) {
            // Convert datetime-local to ISO (treating input as Ecuador time)
            let scheduledAtISO: string
            try {
              scheduledAtISO = datetimeLocalToISO(acceptanceData.scheduled_at)
            } catch (error: any) {
              throw createError({
                statusCode: 400,
                statusMessage: `Invalid date format: ${error.message}`
              })
            }
            
            // Validate date is in the future
            if (!isDateInFuture(scheduledAtISO)) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Proposed scheduled date must be in the future'
              })
            }
            updateData.acceptance_proposed_scheduled_at = scheduledAtISO
          }
          
          if (acceptanceData.location !== undefined) {
            updateData.acceptance_proposed_location = acceptanceData.location || null
          }
          
          // Clear any previous approval/rejection of acceptance change
          updateData.acceptance_change_approved_by = null
          updateData.acceptance_change_rejected_by = null
          
          // Notify player1 about acceptance with proposed changes
          if (match.player1_id) {
            pendingNotifications.push({
              playerId: match.player1_id,
              type: 'acceptance_change',
              metadata: {
                accepted_by: currentPlayer.id,
                proposed_scheduled_at: acceptanceData.scheduled_at,
                proposed_location: acceptanceData.location
              }
            })
          }
        } else {
          // Notify player1 that match was accepted without changes
          if (match.player1_id) {
            pendingNotifications.push({
              playerId: match.player1_id,
              type: 'match_created',
              metadata: {
                accepted_by: currentPlayer.id
              }
            })
          }
        }
        
        // Dismiss the match proposal notification for player2
        dismissNotifications.push({
          playerId: currentPlayer.id,
          types: ['match_proposal']
        })
        
        break
      }
      
      case 'approve_acceptance_change': {
        // Only player1 can approve the acceptance change (they proposed the original match)
        if (match.player2_id === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot approve your own acceptance change proposal'
          })
        }
        
        // Must be player1
        if (match.player1_id !== currentPlayer.id) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the match proposer can approve acceptance changes'
          })
        }
        
        // Check if match was accepted
        if (!match.match_accepted_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has not been accepted yet'
          })
        }
        
        // Check if there's a change proposal
        if (!match.acceptance_proposed_scheduled_at && match.acceptance_proposed_location === null) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No acceptance change has been proposed'
          })
        }
        
        // Check if already approved or rejected
        if (match.acceptance_change_approved_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Acceptance change has already been approved'
          })
        }
        
        if (match.acceptance_change_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Acceptance change has already been rejected'
          })
        }
        
        // Apply the proposed changes
        if (match.acceptance_proposed_scheduled_at) {
          updateData.scheduled_at = match.acceptance_proposed_scheduled_at
        }
        
        if (match.acceptance_proposed_location !== null) {
          updateData.location = match.acceptance_proposed_location
        }
        
        updateData.acceptance_change_approved_by = currentPlayer.id
        // Clear proposal fields
        updateData.acceptance_proposed_scheduled_at = null
        updateData.acceptance_proposed_location = null
        updateData.acceptance_change_rejected_by = null
        
        // Dismiss acceptance_change notifications for both players
        if (match.player1_id) {
          dismissNotifications.push({
            playerId: match.player1_id,
            types: ['acceptance_change']
          })
        }
        if (match.player2_id) {
          dismissNotifications.push({
            playerId: match.player2_id,
            types: ['acceptance_change']
          })
        }
        break
      }
      
      case 'reject_acceptance_change': {
        // Only player1 can reject the acceptance change (they proposed the original match)
        if (match.player2_id === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot reject your own acceptance change proposal'
          })
        }
        
        // Must be player1
        if (match.player1_id !== currentPlayer.id) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the match proposer can reject acceptance changes'
          })
        }
        
        // Check if match was accepted
        if (!match.match_accepted_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has not been accepted yet'
          })
        }
        
        // Check if there's a change proposal
        if (!match.acceptance_proposed_scheduled_at && match.acceptance_proposed_location === null) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No acceptance change has been proposed'
          })
        }
        
        // Check if already approved or rejected
        if (match.acceptance_change_approved_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Acceptance change has already been approved'
          })
        }
        
        if (match.acceptance_change_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Acceptance change has already been rejected'
          })
        }
        
        updateData.acceptance_change_rejected_by = currentPlayer.id
        // Clear proposal fields
        updateData.acceptance_proposed_scheduled_at = null
        updateData.acceptance_proposed_location = null
        break
      }
      
      case 'reject_match': {
        // Only player2 can reject the match (player1 proposed it)
        if (match.player1_id === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot reject your own match proposal'
          })
        }
        
        // Must be player2
        if (match.player2_id !== currentPlayer.id) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the opponent can reject the match'
          })
        }
        
        // Check if match was already accepted or rejected
        if (match.match_accepted_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has already been accepted'
          })
        }
        
        if (match.match_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has already been rejected'
          })
        }
        
        // Check if match was proposed
        if (!match.match_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match has not been proposed yet'
          })
        }
        
        updateData.match_rejected_by = currentPlayer.id
        updateData.status = 'cancelled' // Rejecting cancels the match
        break
      }
      
      case 'propose_schedule': {
        // Propose a schedule for a match that doesn't have a scheduled_at yet
        if (match.status !== 'scheduled') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Can only propose schedule for matches with scheduled status'
          })
        }
        
        if (match.scheduled_at) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Match already has a scheduled date. Use reschedule to change it.'
          })
        }
        
        // Cannot propose schedule if there's already a pending proposal
        if (match.schedule_proposed_by && !match.schedule_approved_by && !match.schedule_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'A schedule proposal is already pending. Wait for the other player to respond.'
          })
        }
        
        const scheduleData = data as { scheduled_at: string }
        if (!scheduleData?.scheduled_at) {
          throw createError({
            statusCode: 400,
            statusMessage: 'scheduled_at is required'
          })
        }
        
        // Convert datetime-local to ISO (treating input as Ecuador time)
        let scheduledAtISO: string
        try {
          scheduledAtISO = datetimeLocalToISO(scheduleData.scheduled_at)
        } catch (error: any) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid date format: ${error.message}`
          })
        }
        
        // Validate date is in the future
        if (!isDateInFuture(scheduledAtISO)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Scheduled date must be in the future'
          })
        }
        
        const scheduledDate = new Date(scheduledAtISO)
        
        // Check if this is a tournament match and validate round deadline
        if (match.tournament_id) {
          const { data: tournamentMatch } = await supabase
            .from('tournament_matches')
            .select('round_deadline')
            .eq('match_id', matchId)
            .single()
          
          if (tournamentMatch?.round_deadline) {
            const deadline = new Date(tournamentMatch.round_deadline)
            if (scheduledDate > deadline) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Cannot schedule tournament match after round deadline. Please contact tournament administrator.'
              })
            }
          }
        }
        
        updateData.schedule_proposed_by = currentPlayer.id
        updateData.schedule_proposed_at = new Date().toISOString()
        updateData.schedule_proposed_scheduled_at = scheduledAtISO
        // Clear any previous approval/rejection
        updateData.schedule_approved_by = null
        updateData.schedule_rejected_by = null
        
        // Notify opponent about schedule proposal
        const opponentId = match.player1_id === currentPlayer.id ? match.player2_id : match.player1_id
        if (opponentId) {
          pendingNotifications.push({
            playerId: opponentId,
            type: 'schedule_proposal',
            metadata: {
              proposed_by: currentPlayer.id,
              scheduled_at: scheduledAtISO
            }
          })
        }
        break
      }
      
      case 'approve_schedule': {
        if (match.status !== 'scheduled') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Schedule can only be approved when match status is scheduled'
          })
        }
        
        if (!match.schedule_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No schedule has been proposed yet'
          })
        }
        
        // Cannot approve your own schedule proposal
        if (match.schedule_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot approve your own schedule proposal'
          })
        }
        
        // Check if already rejected
        if (match.schedule_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'This schedule proposal has already been rejected'
          })
        }
        
        // Update scheduled_at to the proposed date
        updateData.scheduled_at = match.schedule_proposed_scheduled_at
        updateData.schedule_approved_by = currentPlayer.id
        // Clear proposal fields
        updateData.schedule_proposed_by = null
        updateData.schedule_proposed_at = null
        updateData.schedule_proposed_scheduled_at = null
        updateData.schedule_rejected_by = null
        
        // Dismiss schedule proposal notifications for both players
        if (match.player1_id) {
          dismissNotifications.push({
            playerId: match.player1_id,
            types: ['schedule_proposal']
          })
        }
        if (match.player2_id) {
          dismissNotifications.push({
            playerId: match.player2_id,
            types: ['schedule_proposal']
          })
        }
        break
      }
      
      case 'reject_schedule': {
        if (match.status !== 'scheduled') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Schedule can only be rejected when match status is scheduled'
          })
        }
        
        if (!match.schedule_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No schedule has been proposed yet'
          })
        }
        
        // Cannot reject your own schedule proposal
        if (match.schedule_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot reject your own schedule proposal'
          })
        }
        
        // Check if already approved
        if (match.schedule_approved_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'This schedule proposal has already been approved'
          })
        }
        
        updateData.schedule_rejected_by = currentPlayer.id
        // Clear proposal fields
        updateData.schedule_proposed_by = null
        updateData.schedule_proposed_at = null
        updateData.schedule_proposed_scheduled_at = null
        updateData.schedule_approved_by = null
        break
      }
      
      case 'propose_reschedule': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Reschedule can only be proposed when match status is active'
          })
        }
        
        // Cannot propose reschedule if there's already a pending proposal
        if (match.reschedule_proposed_by && !match.reschedule_approved_by && !match.reschedule_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'There is already a pending reschedule proposal'
          })
        }
        
        const rescheduleData = data as ProposeReschedulePayload
        if (!rescheduleData?.scheduled_at) {
          throw createError({
            statusCode: 400,
            statusMessage: 'scheduled_at is required for reschedule proposal'
          })
        }
        
        // Convert datetime-local to ISO (treating input as Ecuador time)
        let rescheduledAtISO: string
        try {
          rescheduledAtISO = datetimeLocalToISO(rescheduleData.scheduled_at)
        } catch (error: any) {
          throw createError({
            statusCode: 400,
            statusMessage: `Invalid date format: ${error.message}`
          })
        }
        
        // Validate new date is in the future
        if (!isDateInFuture(rescheduledAtISO)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'New scheduled date must be in the future'
          })
        }
        
        const newDate = new Date(rescheduledAtISO)
        
        // Check if this is a tournament match and validate round deadline
        if (match.tournament_id) {
          const { data: tournamentMatch } = await supabase
            .from('tournament_matches')
            .select('round_deadline')
            .eq('match_id', matchId)
            .single()
          
          if (tournamentMatch?.round_deadline) {
            const deadline = new Date(tournamentMatch.round_deadline)
            if (newDate > deadline) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Cannot reschedule tournament match after round deadline. Please contact tournament administrator.'
              })
            }
          }
        }
        
        updateData.reschedule_proposed_by = currentPlayer.id
        updateData.reschedule_proposed_at = new Date().toISOString()
        updateData.reschedule_proposed_scheduled_at = rescheduledAtISO
        // Clear any previous approval/rejection
        updateData.reschedule_approved_by = null
        updateData.reschedule_rejected_by = null
        
        // Notify opponent about reschedule proposal
        const opponentId = match.player1_id === currentPlayer.id ? match.player2_id : match.player1_id
        if (opponentId) {
          pendingNotifications.push({
            playerId: opponentId,
            type: 'reschedule_proposal',
            metadata: {
              proposed_by: currentPlayer.id,
              new_scheduled_at: rescheduledAtISO,
              original_scheduled_at: match.scheduled_at
            }
          })
        }
        break
      }
      
      case 'approve_reschedule': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Reschedule can only be approved when match status is active'
          })
        }
        
        if (!match.reschedule_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No reschedule has been proposed yet'
          })
        }
        
        // Cannot approve your own reschedule proposal
        if (match.reschedule_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot approve your own reschedule proposal'
          })
        }
        
        // Check if already rejected
        if (match.reschedule_rejected_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'This reschedule proposal has already been rejected'
          })
        }
        
        // Update scheduled_at to the proposed date
        updateData.scheduled_at = match.reschedule_proposed_scheduled_at
        updateData.reschedule_approved_by = currentPlayer.id
        // Clear proposal fields
        updateData.reschedule_proposed_by = null
        updateData.reschedule_proposed_at = null
        updateData.reschedule_proposed_scheduled_at = null
        updateData.reschedule_rejected_by = null
        
        // Dismiss reschedule proposal notifications for both players
        if (match.player1_id) {
          dismissNotifications.push({
            playerId: match.player1_id,
            types: ['reschedule_proposal']
          })
        }
        if (match.player2_id) {
          dismissNotifications.push({
            playerId: match.player2_id,
            types: ['reschedule_proposal']
          })
        }
        break
      }
      
      case 'reject_reschedule': {
        if (match.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Reschedule can only be rejected when match status is active'
          })
        }
        
        if (!match.reschedule_proposed_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'No reschedule has been proposed yet'
          })
        }
        
        // Cannot reject your own reschedule proposal
        if (match.reschedule_proposed_by === currentPlayer.id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'You cannot reject your own reschedule proposal'
          })
        }
        
        // Check if already approved
        if (match.reschedule_approved_by) {
          throw createError({
            statusCode: 400,
            statusMessage: 'This reschedule proposal has already been approved'
          })
        }
        
        updateData.reschedule_rejected_by = currentPlayer.id
        // Clear proposal fields
        updateData.reschedule_proposed_by = null
        updateData.reschedule_proposed_at = null
        updateData.reschedule_proposed_scheduled_at = null
        updateData.reschedule_approved_by = null
        break
      }
      
      case 'organizer_set_result': {
        // Only organizers can use this action (already verified above)
        const resultData = data as { score?: string, winner_id: string, is_wo?: boolean }
        
        if (!resultData?.winner_id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'winner_id is required'
          })
        }
        
        // Validate winner is one of the players
        if (resultData.winner_id !== match.player1_id && resultData.winner_id !== match.player2_id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Winner must be one of the match players'
          })
        }
        
        // Set score (WO if is_wo is true, otherwise use provided score or default)
        if (resultData.is_wo) {
          updateData.score = 'WO'
        } else if (resultData.score) {
          updateData.score = resultData.score
        } else {
          // If no score provided and not WO, require score
          throw createError({
            statusCode: 400,
            statusMessage: 'Score is required unless marking as Walkover (WO)'
          })
        }
        
        updateData.winner_id = resultData.winner_id
        updateData.status = 'completed'
        updateData.played_at = new Date().toISOString()
        
        // Clear any pending proposals
        updateData.score_proposed_by = null
        updateData.score_proposed_at = null
        updateData.score_approved_by = null
        updateData.reschedule_proposed_by = null
        updateData.reschedule_proposed_at = null
        updateData.reschedule_proposed_scheduled_at = null
        updateData.reschedule_approved_by = null
        updateData.reschedule_rejected_by = null
        
        // If match was scheduled but never played, set scheduled_at to now
        if (!match.scheduled_at) {
          updateData.scheduled_at = new Date().toISOString()
        }
        
        break
      }
      
      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid action'
        })
    }
    
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
      console.error('Update match error:', updateError)
      console.error('Update data:', JSON.stringify(updateData, null, 2))
      console.error('Action:', action)
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
    if ((updatedMatch as any).schedule_proposed_by) {
      const { data: scheduleProposer } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (updatedMatch as any).schedule_proposed_by)
        .single()
      if (scheduleProposer) {
        (updatedMatch as any).schedule_proposed_by_player = scheduleProposer
      }
    }
    
    if ((updatedMatch as any).schedule_approved_by) {
      const { data: scheduleApprover } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (updatedMatch as any).schedule_approved_by)
        .single()
      if (scheduleApprover) {
        (updatedMatch as any).schedule_approved_by_player = scheduleApprover
      }
    }
    
    if ((updatedMatch as any).schedule_rejected_by) {
      const { data: scheduleRejecter } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', (updatedMatch as any).schedule_rejected_by)
        .single()
      if (scheduleRejecter) {
        (updatedMatch as any).schedule_rejected_by_player = scheduleRejecter
      }
    }
    
    // If match was completed and belongs to a tournament, update bracket and standings
    if (updatedMatch.status === 'completed' && updatedMatch.winner_id && updatedMatch.tournament_id) {
      console.log(`[PUT /api/matches/${matchId}] Match completed, checking if tournament match...`)
      try {
        // Get tournament match info to check if it's a group stage match
        const { data: tournamentMatch } = await supabase
          .from('tournament_matches')
          .select('tournament_id, bracket_type, group_id')
          .eq('match_id', matchId)
          .single()

        if (tournamentMatch) {
          console.log(`[PUT /api/matches/${matchId}] Tournament match found, bracket_type: ${tournamentMatch.bracket_type}, calling updateBracketAfterMatch...`)
          // Update bracket progression
          await updateBracketAfterMatch(matchId, updatedMatch.winner_id, supabase)
          console.log(`[PUT /api/matches/${matchId}] updateBracketAfterMatch completed`)

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
              console.error('Error recalculating standings after match:', standingsError)
            }
          }
        }
      } catch (bracketError) {
        // Log error but don't fail the request
        console.error('Error updating bracket after match:', bracketError)
      }
    }
    
    // Update player ratings after match completion (for ALL matches - tournament and regular)
    if (updatedMatch.status === 'completed' && updatedMatch.winner_id && updatedMatch.player1_id && updatedMatch.player2_id) {
      console.log(`[PUT /api/matches/${matchId}] Match completed, updating player ratings...`)
      try {
        const ratingResult = await updateRatingsAfterMatch(matchId, supabase)
        if (ratingResult) {
          console.log(`[PUT /api/matches/${matchId}] Ratings updated - Player1: ${ratingResult.player1.eloChange > 0 ? '+' : ''}${ratingResult.player1.eloChange} ELO, Player2: ${ratingResult.player2.eloChange > 0 ? '+' : ''}${ratingResult.player2.eloChange} ELO`)
        } else {
          console.warn(`[PUT /api/matches/${matchId}] Rating update returned null - check logs for errors`)
        }
      } catch (ratingError) {
        // Log error but don't fail the request - ratings are important but not critical to match flow
        console.error('Error updating ratings after match:', ratingError)
      }
    }
    
    return updatedMatch
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

