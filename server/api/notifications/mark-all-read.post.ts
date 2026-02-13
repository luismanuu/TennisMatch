import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { clerkIdBodySchema, validateBody } from '~/server/utils/validation'

/**
 * POST /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for the current player
 */
export default defineEventHandler(async (event) => {
  try {
    const { clerk_id } = validateBody(clerkIdBodySchema, await readBody(event))
    
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
      logger.error('Mark all as read error', updateError, { playerId: currentPlayer.id })
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
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/notifications/mark-all-read')
  }
})
