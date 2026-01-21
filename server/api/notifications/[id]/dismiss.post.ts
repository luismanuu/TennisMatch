import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

/**
 * POST /api/notifications/[id]/dismiss
 * 
 * Dismiss a notification (hide permanently)
 */
export default defineEventHandler(async (event) => {
  try {
    const notificationId = getRouterParam(event, 'id')
    
    if (!notificationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Notification ID is required'
      })
    }
    
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body
    
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
    
    // Verify notification belongs to player and dismiss it
    const { data: notification, error: updateError } = await supabase
      .from('notifications')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('player_id', currentPlayer.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('[API] Dismiss notification error:', updateError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to dismiss notification',
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
    console.error('[API] Dismiss notification error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
