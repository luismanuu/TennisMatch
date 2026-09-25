import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'

/**
 * POST /api/notifications/[id]/read
 * 
 * Mark a notification as read
 */
export default defineEventHandler(async (event) => {
  const { player: currentPlayer } = await requirePlayer(event)

  try {
    const notificationId = getRouterParam(event, 'id')
    
    if (!notificationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Notification ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Verify notification belongs to player and mark as read
    const { data: notification, error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('player_id', currentPlayer.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('[API] Mark notification as read error:', updateError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to mark notification as read',
        data: updateError
      })
    }
    
    if (!notification) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Notification not found or unauthorized'
      })
    }
    
    return {
      success: true,
      notification
    }
  } catch (error: any) {
    console.error('[API] Mark as read error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
