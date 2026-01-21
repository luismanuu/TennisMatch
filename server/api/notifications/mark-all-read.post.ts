import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

/**
 * POST /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for the current player
 */
export default defineEventHandler(async (event) => {
  try {
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
