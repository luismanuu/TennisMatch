import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!segmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Segment ID is required'
      })
    }
    
    if (!clerkId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerkId)
    
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
