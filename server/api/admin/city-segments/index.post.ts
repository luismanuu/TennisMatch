import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'
import type { CreateCitySegmentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateCitySegmentPayload & { clerk_id: string }>(event)
    const { clerk_id, name, description, city_ids } = body
    
    if (!clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
      })
    }
    
    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'name is required'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Create city segment
    const { data: segment, error: segmentError } = await supabase
      .from('city_segments')
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single()
    
    if (segmentError) {
      console.error('Error creating city segment:', segmentError)
      if (segmentError.code === '23505') {
        throw createError({
          statusCode: 400,
          statusMessage: 'A city segment with this name already exists'
        })
      }
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create city segment'
      })
    }
    
    // Add cities if provided
    if (city_ids && city_ids.length > 0) {
      const citySegmentCities = city_ids.map(cityId => ({
        city_segment_id: segment.id,
        city_id: cityId,
      }))
      
      const { error: citiesError } = await supabase
        .from('city_segment_cities')
        .insert(citySegmentCities)
      
      if (citiesError) {
        console.error('Error adding cities to segment:', citiesError)
        // Don't fail the request, segment was created successfully
      }
    }
    
    // Fetch the complete segment with cities
    const { data: completeSegment, error: fetchError } = await supabase
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
      .eq('id', segment.id)
      .single()
    
    if (fetchError || !completeSegment) {
      return {
        success: true,
        segment,
      }
    }
    
    // Transform data
    const transformedSegment = {
      id: completeSegment.id,
      name: completeSegment.name,
      description: completeSegment.description,
      created_at: completeSegment.created_at,
      updated_at: completeSegment.updated_at,
      cities: completeSegment.city_segment_cities
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
