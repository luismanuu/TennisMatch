import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import { updatePreviousRanks } from '~/server/utils/update-previous-ranks'
import { clerkIdQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

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
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    
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
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/admin/rankings/update-previous-ranks')
  }
})
