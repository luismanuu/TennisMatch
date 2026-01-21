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
    
    // Fetch all pending notifications (not read and not dismissed)
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
          tournament:tournaments(
            id,
            name,
            status
          )
        )
      `)
      .eq('player_id', currentPlayer.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
    
    if (notificationsError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch notifications',
        data: notificationsError
      })
    }
    
    // Ensure notifications is an array (safety check)
    const notificationsList = notifications || []
    
    // Categorize notifications by type
    const categorized = {
      match_proposals: notificationsList.filter(n => n.type === 'match_proposal'),
      match_created: notificationsList.filter(n => n.type === 'match_created'),
      score_proposals: notificationsList.filter(n => n.type === 'score_proposal'),
      schedule_proposals: notificationsList.filter(n => n.type === 'schedule_proposal'),
      reschedule_proposals: notificationsList.filter(n => n.type === 'reschedule_proposal'),
      acceptance_changes: notificationsList.filter(n => n.type === 'acceptance_change')
    }
    
    // Count totals
    const totalCount = notificationsList.length
    const unreadCount = notificationsList.filter(n => !n.is_read).length
    
    return {
      success: true,
      notifications: notificationsList,
      categorized,
      count: {
        total: totalCount,
        unread: unreadCount,
        match_proposals: categorized.match_proposals.length,
        match_created: categorized.match_created.length,
        score_proposals: categorized.score_proposals.length,
        schedule_proposals: categorized.schedule_proposals.length,
        reschedule_proposals: categorized.reschedule_proposals.length,
        acceptance_changes: categorized.acceptance_changes.length
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
