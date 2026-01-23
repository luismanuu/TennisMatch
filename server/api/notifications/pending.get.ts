import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

/**
 * GET /api/notifications/pending
 * 
 * Returns all unread, non-dismissed notifications for the current player
 * Includes full match details and categorization by type
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerk_id = query.clerk_id as string
    
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
    
    // Get limit from query (default 50, max 200 for performance)
    // Reduced from 100 to improve load time
    const limit = Math.min(parseInt(query.limit as string) || 50, 200)
    
    // Fetch pending notifications (not read and not dismissed)
    // Limit to most recent to handle large volumes efficiently
    // Only load essential match fields to improve performance
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select(`
        id,
        player_id,
        type,
        match_id,
        is_read,
        is_dismissed,
        created_at,
        read_at,
        dismissed_at,
        metadata,
        match:matches!notifications_match_id_fkey(
          id,
          player1_id,
          player2_id,
          scheduled_at,
          location,
          status,
          score,
          tournament_id,
          match_proposed_by,
          match_accepted_by,
          match_rejected_by,
          score_proposed_by,
          score_approved_by,
          schedule_proposed_by,
          schedule_approved_by,
          schedule_rejected_by,
          reschedule_proposed_by,
          reschedule_approved_by,
          reschedule_rejected_by,
          acceptance_proposed_scheduled_at,
          acceptance_change_approved_by,
          acceptance_change_rejected_by,
          player1:players!matches_player1_id_fkey(
            id,
            name
          ),
          player2:players!matches_player2_id_fkey(
            id,
            name
          )
        )
      `)
      .eq('player_id', currentPlayer.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (notificationsError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch notifications',
        data: notificationsError
      })
    }
    
    // Ensure notifications is an array (safety check)
    const notificationsList = notifications || []
    
    // Filter notifications to only include those where current user has a pending action
    // This matches the logic from the "Acciones Pendientes" filter
    // Filter cancelled matches first to reduce processing
    const actionableNotifications = notificationsList.filter((n: any) => {
      const match = n.match
      if (!match) return false
      
      // Exclude cancelled matches early
      if (match.status === 'cancelled') return false
      
      const isPlayer1 = match.player1_id === currentPlayer.id
      const isPlayer2 = match.player2_id === currentPlayer.id
      
      // User must be involved in the match
      if (!isPlayer1 && !isPlayer2) return false
      
      // 1. Match proposal - only count if user is player2 (needs to accept)
      if (n.type === 'match_proposal') {
        return isPlayer2 && match.match_proposed_by && match.match_proposed_by !== currentPlayer.id && !match.match_accepted_by && !match.match_rejected_by
      }
      
      // 2. Score proposal - only count if user is NOT the proposer (needs to approve)
      if (n.type === 'score_proposal') {
        return match.score_proposed_by && match.score_proposed_by !== currentPlayer.id && !match.score_approved_by
      }
      
      // 3. Schedule proposal - only count if user is NOT the proposer (needs to approve)
      if (n.type === 'schedule_proposal') {
        return match.schedule_proposed_by && match.schedule_proposed_by !== currentPlayer.id && !match.schedule_approved_by && !match.schedule_rejected_by
      }
      
      // 4. Reschedule proposal - only count if user is NOT the proposer (needs to approve)
      if (n.type === 'reschedule_proposal') {
        return match.reschedule_proposed_by && match.reschedule_proposed_by !== currentPlayer.id && !match.reschedule_approved_by && !match.reschedule_rejected_by
      }
      
      // 5. Acceptance change - only count if user is player1 (needs to approve)
      if (n.type === 'acceptance_change') {
        return isPlayer1 && match.match_proposed_by === currentPlayer.id && match.acceptance_proposed_scheduled_at && !match.acceptance_change_approved_by && !match.acceptance_change_rejected_by
      }
      
      // 6. Match created - don't count (informational only, no action required)
      if (n.type === 'match_created') {
        return false
      }
      
      return false
    })
    
    // Categorize actionable notifications by type
    const categorized = {
      match_proposals: actionableNotifications.filter((n: any) => n.type === 'match_proposal'),
      match_created: actionableNotifications.filter((n: any) => n.type === 'match_created'),
      score_proposals: actionableNotifications.filter((n: any) => n.type === 'score_proposal'),
      schedule_proposals: actionableNotifications.filter((n: any) => n.type === 'schedule_proposal'),
      reschedule_proposals: actionableNotifications.filter((n: any) => n.type === 'reschedule_proposal'),
      acceptance_changes: actionableNotifications.filter((n: any) => n.type === 'acceptance_change')
    }
    
    // Count totals (only actionable notifications)
    const totalCount = actionableNotifications.length
    const unreadCount = actionableNotifications.filter((n: any) => !n.is_read).length
    
    // Check if there are more notifications beyond the limit
    const hasMore = actionableNotifications.length >= limit
    
    return {
      success: true,
      notifications: actionableNotifications, // Only return actionable notifications
      categorized,
      count: {
        total: totalCount,
        unread: unreadCount,
        match_proposals: categorized.match_proposals.length,
        match_created: categorized.match_created.length,
        score_proposals: categorized.score_proposals.length,
        schedule_proposals: categorized.schedule_proposals.length,
        reschedule_proposals: categorized.reschedule_proposals.length,
        acceptance_changes: categorized.acceptance_changes.length,
        hasMore,
        displayed: actionableNotifications.length
      }
    }
  } catch (error: any) {
    console.error('[API] Get pending notifications error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
