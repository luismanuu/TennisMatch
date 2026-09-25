import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'

/**
 * POST /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for the current player
 */
export default defineEventHandler(async (event) => {
  const { player: currentPlayer } = await requirePlayer(event)

  try {
    const supabase = getSupabaseAdmin()
    
    // Mark all unread notifications as read
    const { data: notifications, error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('player_id', currentPlayer.id)
      .eq('is_read', false)
      .eq('is_dismissed', false)
      .select()
    
    if (updateError) {
      console.error('[API] Mark all as read error:', updateError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to mark all notifications as read',
        data: updateError
      })
    }
    
    return {
      success: true,
      count: notifications?.length || 0,
      notifications
    }
  } catch (error: any) {
    console.error('[API] Mark all as read error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
