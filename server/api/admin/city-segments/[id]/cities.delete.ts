import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'
import type { RemoveCityFromSegmentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const cityId = query.city_id as string
    
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
    
    if (!cityId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'city_id is required'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Remove city from segment
    const { error: deleteError } = await supabase
      .from('city_segment_cities')
      .delete()
      .eq('city_segment_id', segmentId)
      .eq('city_id', cityId)
    
    if (deleteError) {
      console.error('Error removing city from segment:', deleteError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to remove city from segment'
      })
    }
    
    // Fetch updated segment
    const { data: updatedSegment, error: fetchError } = await supabase
      .from('city_segments')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        city_segment_cities(
          id,
          city_id,
          city:cities(
            id,
            name,
            order
          )
        )
      `)
      .eq('id', segmentId)
      .single()
    
    if (fetchError || !updatedSegment) {
      return {
        success: true,
        message: 'City removed from segment successfully',
      }
    }
    
    // Transform data
    const transformedSegment = {
      id: updatedSegment.id,
      name: updatedSegment.name,
      description: updatedSegment.description,
      created_at: updatedSegment.created_at,
      updated_at: updatedSegment.updated_at,
      cities: updatedSegment.city_segment_cities
        ?.map((csc: any) => csc.city)
        .filter(Boolean)
        .sort((a: any, b: any) => a.order - b.order) ?? [],
    }
    
    return {
      success: true,
      segment: transformedSegment,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
