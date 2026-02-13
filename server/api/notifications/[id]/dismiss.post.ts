import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { clerkIdBodySchema, notificationIdSchema, validateBody, validateParam } from '~/server/utils/validation'

/**
 * POST /api/notifications/[id]/dismiss
 * 
 * Dismiss a notification (hide permanently)
 */
export default defineEventHandler(async (event) => {
  let notificationId: string | undefined
  try {
    notificationId = validateParam(notificationIdSchema, getRouterParam(event, 'id'))

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
      logger.error('Dismiss notification error', updateError, { notificationId, playerId: currentPlayer.id })
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
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/notifications/[id]/dismiss')
  }
})
