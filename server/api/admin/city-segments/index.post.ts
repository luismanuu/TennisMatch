import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
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
      logger.error('Error creating city segment', segmentError)
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
        logger.error('Error adding cities to segment', citiesError, { segmentId: segment.id })
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
    type CityRef = { id: string; name: string; order: number | null }
    const transformedSegment = {
      id: completeSegment.id,
      name: completeSegment.name,
      description: completeSegment.description,
      created_at: completeSegment.created_at,
      updated_at: completeSegment.updated_at,
      cities: completeSegment.city_segment_cities
        ?.map((csc: unknown) => {
          const row = csc as { city?: CityRef | null } | null
          return row?.city ?? null
        })
        .filter((c): c is CityRef => Boolean(c))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) ?? [],
    }
    
    return {
      success: true,
      segment: transformedSegment,
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/admin/city-segments/index')
  }
})
