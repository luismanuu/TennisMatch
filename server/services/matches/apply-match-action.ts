import { createError } from 'h3'
import { datetimeLocalToISO, isDateInFuture } from '~/server/utils/timezone'
import type { ProposeReschedulePayload, ProposeScorePayload, UpdateMatchStatusPayload } from '~/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type MatchNotificationType =
  | 'match_proposal'
  | 'match_created'
  | 'score_proposal'
  | 'schedule_proposal'
  | 'reschedule_proposal'
  | 'acceptance_change'

export type PendingNotification = {
  playerId: string
  type: MatchNotificationType
  metadata?: Record<string, unknown>
}

export type DismissNotification = {
  playerId: string
  types: MatchNotificationType[]
}

type PendingPlayerRef = {
  status?: string | null
  invited_by_player_id?: string | null
}

export type MatchRow = {
  id?: string
  status?: string | null
  tournament_id?: string | null
  player1_id?: string | null
  player2_id?: string | null
  pending_player2_id?: string | null
  pending_player2?: PendingPlayerRef | null

  // Acceptance flow
  match_proposed_by?: string | null
  match_accepted_by?: string | null
  match_rejected_by?: string | null

  acceptance_proposed_scheduled_at?: string | null
  acceptance_proposed_location?: string | null
  acceptance_change_approved_by?: string | null
  acceptance_change_rejected_by?: string | null

  // Score flow
  score?: string | null
  winner_id?: string | null
  score_proposed_by?: string | null
  score_proposed_at?: string | null
  score_approved_by?: string | null

  // Scheduling flow
  scheduled_at?: string | null
  location?: string | null
  schedule_proposed_at?: string | null
  schedule_proposed_scheduled_at?: string | null
  schedule_proposed_by?: string | null
  schedule_approved_by?: string | null
  schedule_rejected_by?: string | null
  reschedule_proposed_at?: string | null
  reschedule_proposed_scheduled_at?: string | null
  reschedule_proposed_by?: string | null
  reschedule_approved_by?: string | null
  reschedule_rejected_by?: string | null
}

export type ApplyMatchActionParams = {
  action: string
  data: unknown
  match: MatchRow
  matchId: string
  currentPlayerId: string
  isAdmin: boolean
  supabase: SupabaseClient
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * Compute the `matches` table update payload + notification side-effects for a given match action.
 * This is extracted from `server/api/matches/[id].put.ts` to keep the route thin and maintainable.
 */
export async function applyMatchAction(params: ApplyMatchActionParams): Promise<{
  updateData: Record<string, unknown>
  pendingNotifications: PendingNotification[]
  dismissNotifications: DismissNotification[]
}> {
  const { action, data, match, matchId, currentPlayerId, isAdmin, supabase } = params

  const updateData: Record<string, unknown> = {}

  // Track notifications to create after match update
  const pendingNotifications: PendingNotification[] = []

  // Track notifications to dismiss after match update
  const dismissNotifications: DismissNotification[] = []

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
        if (match.pending_player2_id && match.pending_player2?.status === 'pending') {
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
        if (
          (match.acceptance_proposed_scheduled_at || match.acceptance_proposed_location !== null) &&
          !match.acceptance_change_approved_by &&
          !match.acceptance_change_rejected_by
        ) {
          throw createError({
            statusCode: 400,
            statusMessage:
              'Cannot activate match: pending acceptance change proposal must be approved or rejected first'
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
      updateData.score_proposed_by = currentPlayerId
      updateData.score_proposed_at = new Date().toISOString()

      // Notify opponent about score proposal (after update completes)
      const opponentId = match.player1_id === currentPlayerId ? match.player2_id : match.player1_id
      if (opponentId) {
        pendingNotifications.push({
          playerId: opponentId,
          type: 'score_proposal',
          metadata: {
            proposed_by: currentPlayerId,
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
      if (match.score_proposed_by === currentPlayerId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You cannot approve your own score proposal'
        })
      }

      updateData.score_approved_by = currentPlayerId
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
      if (match.score_proposed_by === currentPlayerId) {
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
      // Admins can cancel any match (except completed), regular users have restrictions
      if (!isAdmin) {
        // Regular users: only player1 can cancel before acceptance, both players can cancel after acceptance
        const isPlayer1 = match.player1_id === currentPlayerId
        const isPlayer2 = match.player2_id === currentPlayerId

        if (!isPlayer1 && !isPlayer2) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only players in the match can cancel it'
          })
        }

        // Only player1 can cancel before acceptance
        if (!match.match_accepted_by && !isPlayer1) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the match proposer can cancel before acceptance'
          })
        }
      }

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
      if (match.player1_id === currentPlayerId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You cannot accept your own match proposal'
        })
      }

      // Must be player2
      if (match.player2_id !== currentPlayerId) {
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
      updateData.match_accepted_by = currentPlayerId

      // If player2 provided alternative schedule/location, store it as a proposal
      const acceptanceData = data as { scheduled_at?: string; location?: string } | undefined
      if (acceptanceData) {
        if (acceptanceData.scheduled_at) {
          // Convert datetime-local to ISO (treating input as Ecuador time)
          let scheduledAtISO: string
          try {
            scheduledAtISO = datetimeLocalToISO(acceptanceData.scheduled_at)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
            throw createError({
              statusCode: 400,
          statusMessage: `Invalid date format: ${message}`
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
              accepted_by: currentPlayerId,
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
              accepted_by: currentPlayerId
            }
          })
        }
      }

      // Dismiss the match proposal notification for player2
      dismissNotifications.push({
        playerId: currentPlayerId,
        types: ['match_proposal']
      })

      break
    }

    case 'approve_acceptance_change': {
      // Only player1 can approve the acceptance change (they proposed the original match)
      if (match.player2_id === currentPlayerId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You cannot approve your own acceptance change proposal'
        })
      }

      // Must be player1
      if (match.player1_id !== currentPlayerId) {
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

      updateData.acceptance_change_approved_by = currentPlayerId
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
      if (match.player2_id === currentPlayerId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You cannot reject your own acceptance change proposal'
        })
      }

      // Must be player1
      if (match.player1_id !== currentPlayerId) {
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

      updateData.acceptance_change_rejected_by = currentPlayerId
      // Clear proposal fields
      updateData.acceptance_proposed_scheduled_at = null
      updateData.acceptance_proposed_location = null
      break
    }

    case 'reject_match': {
      // Only player2 can reject the match (player1 proposed it)
      if (match.player1_id === currentPlayerId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You cannot reject your own match proposal'
        })
      }

      // Must be player2
      if (match.player2_id !== currentPlayerId) {
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

      updateData.match_rejected_by = currentPlayerId
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid date format: ${message}`
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
              statusMessage:
                'Cannot schedule tournament match after round deadline. Please contact tournament administrator.'
            })
          }
        }
      }

      updateData.schedule_proposed_by = currentPlayerId
      updateData.schedule_proposed_at = new Date().toISOString()
      updateData.schedule_proposed_scheduled_at = scheduledAtISO
      // Clear any previous approval/rejection
      updateData.schedule_approved_by = null
      updateData.schedule_rejected_by = null

      // Notify opponent about schedule proposal
      const opponentId = match.player1_id === currentPlayerId ? match.player2_id : match.player1_id
      if (opponentId) {
        pendingNotifications.push({
          playerId: opponentId,
          type: 'schedule_proposal',
          metadata: {
            proposed_by: currentPlayerId,
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
      if (match.schedule_proposed_by === currentPlayerId) {
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
      updateData.schedule_approved_by = currentPlayerId
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
      if (match.schedule_proposed_by === currentPlayerId) {
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

      updateData.schedule_rejected_by = currentPlayerId
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid date format: ${message}`
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
              statusMessage:
                'Cannot reschedule tournament match after round deadline. Please contact tournament administrator.'
            })
          }
        }
      }

      updateData.reschedule_proposed_by = currentPlayerId
      updateData.reschedule_proposed_at = new Date().toISOString()
      updateData.reschedule_proposed_scheduled_at = rescheduledAtISO
      // Clear any previous approval/rejection
      updateData.reschedule_approved_by = null
      updateData.reschedule_rejected_by = null

      // Notify opponent about reschedule proposal
      const opponentId = match.player1_id === currentPlayerId ? match.player2_id : match.player1_id
      if (opponentId) {
        pendingNotifications.push({
          playerId: opponentId,
          type: 'reschedule_proposal',
          metadata: {
            proposed_by: currentPlayerId,
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
      if (match.reschedule_proposed_by === currentPlayerId) {
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
      updateData.reschedule_approved_by = currentPlayerId
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
      if (match.reschedule_proposed_by === currentPlayerId) {
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

      updateData.reschedule_rejected_by = currentPlayerId
      // Clear proposal fields
      updateData.reschedule_proposed_by = null
      updateData.reschedule_proposed_at = null
      updateData.reschedule_proposed_scheduled_at = null
      updateData.reschedule_approved_by = null
      break
    }

    case 'organizer_set_result': {
      // Only organizers can use this action (already verified in the route)
      const resultData = data as { score?: string; winner_id: string; is_wo?: boolean }

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

  return { updateData, pendingNotifications, dismissNotifications }
}

