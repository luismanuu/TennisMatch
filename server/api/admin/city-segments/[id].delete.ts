import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const segmentId = getRouterParam(event, 'id')
    
    if (!segmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Segment ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Delete city segment (cascades to city_segment_cities)
    const { error: deleteError } = await supabase
      .from('city_segments')
      .delete()
      .eq('id', segmentId)
    
    if (deleteError) {
      console.error('Error deleting city segment:', deleteError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete city segment'
      })
    }
    
    return {
      success: true,
      message: 'City segment deleted successfully',
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
