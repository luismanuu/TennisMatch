import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import { clerkIdQuerySchema, uuidSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = validateParam(uuidSchema, getRouterParam(event, 'id'))
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    
    // Verify admin
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Delete city segment (cascades to city_segment_cities)
    const { error: deleteError } = await supabase
      .from('city_segments')
      .delete()
      .eq('id', segmentId)
    
    if (deleteError) {
      logger.error('Error deleting city segment', deleteError, { segmentId: getRouterParam(event, 'id') })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete city segment'
      })
    }
    
    return {
      success: true,
      message: 'City segment deleted successfully',
    }
  } catch (error: unknown) {
    handleApiError(error, 'DELETE /api/admin/city-segments/[id]')
  }
})
