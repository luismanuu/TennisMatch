import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkIsOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { updateBracketAfterMatch, recalculateGroupStandings } from '~/server/utils/tournament-brackets'
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
      action: 'update_status' | 'propose_score' | 'approve_score' | 'reject_score' | 'cancel' | 'propose_schedule' | 'approve_schedule' | 'reject_schedule' | 'propose_reschedule' | 'approve_reschedule' | 'reject_reschedule' | 'organizer_set_result'
      data?: UpdateMatchStatusPayload | ProposeScorePayload | ApproveScorePayload | ProposeReschedulePayload | { score?: string, winner_id: string, is_wo?: boolean }
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
        
        // Validate date is in the future
        const scheduledDate = new Date(scheduleData.scheduled_at)
        if (scheduledDate <= new Date()) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Scheduled date must be in the future'
          })
        }
        
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
        updateData.schedule_proposed_scheduled_at = scheduleData.scheduled_at
        // Clear any previous approval/rejection
        updateData.schedule_approved_by = null
        updateData.schedule_rejected_by = null
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
        
        // Validate new date is in the future
        const newDate = new Date(rescheduleData.scheduled_at)
        if (newDate <= new Date()) {
          throw createError({
            statusCode: 400,
            statusMessage: 'New scheduled date must be in the future'
          })
        }
        
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
        updateData.reschedule_proposed_scheduled_at = rescheduleData.scheduled_at
        // Clear any previous approval/rejection
        updateData.reschedule_approved_by = null
        updateData.reschedule_rejected_by = null
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
      try {
        // Get tournament match info to check if it's a group stage match
        const { data: tournamentMatch } = await supabase
          .from('tournament_matches')
          .select('tournament_id, bracket_type, group_id')
          .eq('match_id', matchId)
          .single()

        if (tournamentMatch) {
          // Update bracket progression
          await updateBracketAfterMatch(matchId, updatedMatch.winner_id, supabase)

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
    
    return updatedMatch
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

