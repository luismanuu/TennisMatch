import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { updatePreviousRanks } from '~/server/utils/update-previous-ranks'

/**
 * API endpoint to update previous_rank for all players
 * This should be called periodically (e.g., daily via cron job)
 * 
 * POST /api/admin/rankings/update-previous-ranks?clerk_id=xxx
 * 
 * Requires admin authentication
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }
    
    // Check admin authentication
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Update previous ranks
    const updatedCount = await updatePreviousRanks(supabase)
    
    return {
      success: true,
      message: `Updated previous_rank for ${updatedCount} players`,
      updated_count: updatedCount
    }
  } catch (error: any) {
    console.error('Error updating previous ranks:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update previous ranks'
    })
  }
})
