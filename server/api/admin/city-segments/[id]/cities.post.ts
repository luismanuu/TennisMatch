import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'
import type { AddCitiesToSegmentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = getRouterParam(event, 'id')
    
    if (!segmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Segment ID is required'
      })
    }
    
    const body = await readBody<AddCitiesToSegmentPayload & { clerk_id: string }>(event)
    const { clerk_id, city_ids } = body
    
    if (!clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
      })
    }
    
    if (!city_ids || city_ids.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'city_ids is required and must not be empty'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Verify segment exists
    const { data: segment, error: segmentError } = await supabase
      .from('city_segments')
      .select('id')
      .eq('id', segmentId)
      .single()
    
    if (segmentError || !segment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'City segment not found'
      })
    }
    
    // Add cities to segment (ignore duplicates)
    const citySegmentCities = city_ids.map(cityId => ({
      city_segment_id: segmentId,
      city_id: cityId,
    }))
    
    const { error: insertError } = await supabase
      .from('city_segment_cities')
      .upsert(citySegmentCities, { onConflict: 'city_segment_id,city_id' })
    
    if (insertError) {
      console.error('Error adding cities to segment:', insertError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to add cities to segment'
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
        message: 'Cities added successfully',
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
