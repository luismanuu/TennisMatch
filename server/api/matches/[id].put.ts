import { and, eq, sql, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, players, tournament_matches } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { updateBracketAfterMatch, recalculateGroupStandings } from '~/server/utils/tournament-brackets'
import { updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { classifyScore, classifyStoredScore, type MatchClassification } from '~/server/utils/elo'
import { statusChangeError, type MatchStatus } from '~/server/utils/match-transitions'
import { checkWinner, parseScore, renderScore } from '~/utils/score'
import { createMatchNotification, dismissExistingNotifications } from '~/server/utils/notifications'
import { datetimeLocalToISO, isDateInFuture } from '~/server/utils/timezone'
import type { ProposeScorePayload, ApproveScorePayload, UpdateMatchStatusPayload, ProposeReschedulePayload } from '~/types'

const namedPlayer = { columns: { id: true, name: true } } as const
const playerWithCategory = {
  columns: { id: true, name: true },
  with: { category: { columns: { id: true, name: true, description: true, order: true } } },
} as const

// The match as this route has always returned it (the Vue pages read these nested keys)
const matchResponseRelations = {
  player1: playerWithCategory,
  player2: playerWithCategory,
  pending_player2: {
    columns: { id: true, name: true, status: true },
    with: { category: { columns: { id: true, name: true, description: true, order: true } } },
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
    
    const body = await readBody<{
      action: 'update_status' | 'propose_score' | 'approve_score' | 'reject_score' | 'cancel' | 'accept_match' | 'reject_match' | 'propose_schedule' | 'approve_schedule' | 'reject_schedule' | 'propose_reschedule' | 'approve_reschedule' | 'reject_reschedule' | 'approve_acceptance_change' | 'reject_acceptance_change' | 'organizer_set_result'
      data?: UpdateMatchStatusPayload | ProposeScorePayload | ApproveScorePayload | ProposeReschedulePayload | { score?: string, winner_id: string, is_wo?: boolean } | { scheduled_at?: string, location?: string }
    }>(event)
    
    const { action, data } = body
    
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
    
    // Fetch match to verify user is part of it or is organizer
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        pending_player2: { columns: { id: true, status: true, invited_by_player_id: true } },
        tournament: { columns: { id: true, organizer_id: true, created_by: true } },
      },
    })
    
    if (!match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Check if user is organizer of the tournament (if match belongs to a tournament)
    let isTournamentOrganizer = false
    if (match.tournament_id && match.tournament) {
      if (user.role === 'tournament_organizer') {
        try {
          await verifyOrganizerOwnsTournament(currentPlayer.id, match.tournament_id)
          isTournamentOrganizer = true
        } catch (err) {
          // Not organizer of this tournament
          isTournamentOrganizer = false
        }
      }
    }
    
    // Check if user is admin
    const isAdmin = user.role === 'admin'
    
    // Verify user is part of the match (unless they're organizer and action is organizer-specific, or admin)
    if (body.action !== 'organizer_set_result' && !isAdmin) {
      const isPlayer1 = match.player1_id === currentPlayer.id
      const isPlayer2 = match.player2_id === currentPlayer.id
      const isPendingPlayerInviter = match.pending_player2_id &&
        match.pending_player2?.invited_by_player_id === currentPlayer.id
      
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
    
    const updateData: Partial<typeof matches.$inferInsert> = {}
    // Extra conditions on the match row for the write (the status checked here is always one of them)
    const writeGuards: SQL[] = []
    // How the result being completed was classified (score parser or an explicit form choice), for the rating
    let classification: MatchClassification | undefined

    // The side of the match a winner id is on, for the score check (the score lists player 1's games first)
    const sideOf = (winnerId: string): 'p1' | 'p2' => (winnerId === match.player1_id ? 'p1' : 'p2')
    const parsedResult = (text: string | undefined, winnerId: string) => {
      const parsed = parseScore(text)
      if (!parsed.ok) {
        throw createError({ statusCode: 400, statusMessage: parsed.error })
      }
      const winnerError = checkWinner(parsed.score, sideOf(winnerId))
      if (winnerError) {
        throw createError({ statusCode: 400, statusMessage: winnerError })
      }
      return { score: renderScore(parsed.score), classification: classifyScore(parsed.score, 'parser') }
    }
    
    // Track notifications to create after match update
    const pendingNotifications: Array<{
      playerId: string
      type: 'match_proposal' | 'match_created' | 'score_proposal' | 'schedule_proposal' | 'reschedule_proposal' | 'acceptance_change'
      metadata?: Record<string, unknown>
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
        
        // A match is completed only by an approved score or an organizer result, which also rates it;
        // a completed match keeps its status, so its ratings never belong to a match that is not completed.
        if (statusData.status === 'completed') {
          throw createError({
            statusCode: 400,
            statusMessage: 'A match is completed by approving its score'
          })
        }
        if (match.status === 'completed') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Cannot change the status of a completed match'
          })
        }
        // update_status only starts a match; cancelling goes through `cancel`, which has its own rules
        if (statusData.status !== 'active') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Con esta acción solo puedes iniciar el partido. Para cancelarlo, usa Cancelar.'
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
        
        updateData.score = parsedResult(scoreData.score, scoreData.winner_id).score
        updateData.winner_id = scoreData.winner_id
        updateData.score_proposed_by = currentPlayer.id
        updateData.score_proposed_at = new Date()
        
        // Notify opponent about score proposal (after update completes)
        const opponentId = match.player1_id === currentPlayer.id ? match.player2_id : match.player1_id
        if (opponentId) {
          // A new proposal replaces the opponent's notification, so it never shows an earlier score
          dismissNotifications.push({ playerId: opponentId, types: ['score_proposal'] })
          pendingNotifications.push({
            playerId: opponentId,
            type: 'score_proposal',
            metadata: {
              proposed_by: currentPlayer.id,
              score: updateData.score,
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
        
        // The approver names the proposal they saw; a proposal changed since then is not approved
        const seen = data as ApproveScorePayload | undefined
        const seenAt = seen?.score_proposed_at ? new Date(seen.score_proposed_at) : null
        if (!seen?.score || !seen.winner_id || !seenAt || Number.isNaN(seenAt.getTime())) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Vuelve a cargar el partido: falta el marcador que estás aprobando.'
          })
        }
        if (
          seen.score !== match.score ||
          seen.winner_id !== match.winner_id ||
          seenAt.getTime() !== match.score_proposed_at?.getTime()
        ) {
          throw createError({
            statusCode: 409,
            statusMessage: 'El marcador cambió desde que lo viste. Revísalo antes de aprobarlo.'
          })
        }
        writeGuards.push(
          eq(matches.score, seen.score),
          eq(matches.winner_id, seen.winner_id),
          sql`date_trunc('milliseconds', ${matches.score_proposed_at}) = ${seenAt.toISOString()}::timestamptz`,
        )
        classification = classifyStoredScore(match.score)

        updateData.score_approved_by = currentPlayer.id
        updateData.status = 'completed'
        updateData.played_at = new Date()
        
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
        // Admins can cancel any match (except completed), regular users have restrictions
        if (!isAdmin) {
          // Regular users: only player1 can cancel before acceptance, both players can cancel after acceptance
          const isPlayer1 = match.player1_id === currentPlayer.id
          const isPlayer2 = match.player2_id === currentPlayer.id
          
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

          // A tournament match belongs to the bracket: a player cannot drop out of it by cancelling
          if (match.tournament_id) {
            throw createError({
              statusCode: 403,
              statusMessage: 'Un partido de torneo solo lo puede cancelar un administrador.'
            })
          }
        }
        
        if (match.status === 'completed') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Cannot cancel a completed match'
          })
        }
        
        if (match.status === 'active' && !isAdmin) {
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
            updateData.acceptance_proposed_scheduled_at = new Date(scheduledAtISO)
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
          const tournamentMatch = await db.query.tournament_matches.findFirst({
            columns: { round_deadline: true },
            where: eq(tournament_matches.match_id, matchId),
          })
          
          if (tournamentMatch?.round_deadline) {
            const deadline = tournamentMatch.round_deadline
            if (scheduledDate > deadline) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Cannot schedule tournament match after round deadline. Please contact tournament administrator.'
              })
            }
          }
        }
        
        updateData.schedule_proposed_by = currentPlayer.id
        updateData.schedule_proposed_at = new Date()
        updateData.schedule_proposed_scheduled_at = scheduledDate
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
          const tournamentMatch = await db.query.tournament_matches.findFirst({
            columns: { round_deadline: true },
            where: eq(tournament_matches.match_id, matchId),
          })
          
          if (tournamentMatch?.round_deadline) {
            const deadline = tournamentMatch.round_deadline
            if (newDate > deadline) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Cannot reschedule tournament match after round deadline. Please contact tournament administrator.'
              })
            }
          }
        }
        
        updateData.reschedule_proposed_by = currentPlayer.id
        updateData.reschedule_proposed_at = new Date()
        updateData.reschedule_proposed_scheduled_at = newDate
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

        // A completed match is already rated; a new result would disagree with its ratings
        if (match.status === 'completed') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Este partido ya está completado: no puedes cambiar su resultado.'
          })
        }
        
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
        
        // A walkover ticked in the form is an explicit classification; a typed score goes through the parser
        if (resultData.is_wo) {
          updateData.score = 'W/O'
          classification = { completion: 'walkover', sets: 'none', source: 'manual' }
        } else if (resultData.score) {
          const result = parsedResult(resultData.score, resultData.winner_id)
          updateData.score = result.score
          classification = result.classification
        } else {
          // If no score provided and not WO, require score
          throw createError({
            statusCode: 400,
            statusMessage: 'Score is required unless marking as Walkover (WO)'
          })
        }
        
        updateData.winner_id = resultData.winner_id
        updateData.status = 'completed'
        updateData.played_at = new Date()
        
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
          updateData.scheduled_at = new Date()
        }
        
        break
      }
      
      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid action'
        })
    }
    
    // One whitelist of status changes (server/utils/match-transitions.ts)
    if (updateData.status !== undefined && updateData.status !== match.status) {
      const transitionError = statusChangeError(action, match.status as MatchStatus, updateData.status as MatchStatus)
      if (transitionError) {
        throw createError({ statusCode: 400, statusMessage: transitionError })
      }
    }

    // The write only applies to the match as it was checked above: same status, and for an approval the same
    // proposal. A result that completes the match is rated in the same transaction, so a match is never completed
    // without its rating, and a second approval finds it completed and changes nothing.
    const completes = updateData.status === 'completed' && match.status !== 'completed'
    const updatedRow = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(matches)
        .set(updateData)
        .where(and(eq(matches.id, matchId), eq(matches.status, match.status), ...writeGuards))
        .returning({ id: matches.id })
      if (row && completes) {
        await updateRatingsAfterMatch(matchId, tx, classification)
      }
      return row
    })

    if (!updatedRow) {
      throw createError({
        statusCode: 409,
        statusMessage: 'El partido cambió mientras lo actualizabas. Vuelve a cargarlo.'
      })
    }

    // Dismiss first: a new proposal replaces the notification it supersedes
    for (const dismiss of dismissNotifications) {
      await dismissExistingNotifications(dismiss.playerId, matchId, dismiss.types)
    }

    for (const notification of pendingNotifications) {
      await createMatchNotification(notification.playerId, matchId, notification.type, notification.metadata)
    }
    
    const updatedMatch = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: matchResponseRelations,
    })
    
    if (!updatedMatch) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found after update'
      })
    }
    
    // If match was completed and belongs to a tournament, update bracket and standings
    if (updatedMatch.status === 'completed' && updatedMatch.winner_id && updatedMatch.tournament_id) {
      try {
        const tournamentMatch = await db.query.tournament_matches.findFirst({
          columns: { tournament_id: true, bracket_type: true, group_id: true },
          where: eq(tournament_matches.match_id, matchId),
        })

        if (tournamentMatch) {
          // Update bracket progression
          await updateBracketAfterMatch(matchId, updatedMatch.winner_id)

          // If it's a group stage match, recalculate standings
          if (tournamentMatch.bracket_type === 'group' && tournamentMatch.group_id) {
            try {
              await recalculateGroupStandings(tournamentMatch.tournament_id, tournamentMatch.group_id)
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
    
    return updatedMatch
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

