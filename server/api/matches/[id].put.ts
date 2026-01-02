import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import type { ProposeScorePayload, ApproveScorePayload, UpdateMatchStatusPayload } from '~/types'

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
      action: 'update_status' | 'propose_score' | 'approve_score' | 'reject_score' | 'cancel'
      data?: UpdateMatchStatusPayload | ProposeScorePayload | ApproveScorePayload
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
    
    // Fetch match to verify user is part of it
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        pending_player2:pending_players(
          id,
          status,
          invited_by_player_id
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
    
    // Verify user is part of the match
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
        
        updateData.status = 'cancelled'
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
        winner:players!matches_winner_id_fkey(
          id,
          name
        )
      `)
      .single()
    
    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update match',
        data: updateError
      })
    }
    
    return updatedMatch
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

