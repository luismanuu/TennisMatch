import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import type { UpdateCitySegmentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = getRouterParam(event, 'id')
    
    if (!segmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Segment ID is required'
      })
    }
    
    const body = await readBody<UpdateCitySegmentPayload & { clerk_id: string }>(event)
    const { clerk_id, name, description } = body
    
    if (!clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    
    if (Object.keys(updateData).length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No update data provided'
      })
    }
    
    // Update city segment
    const { data: segment, error: segmentError } = await supabase
      .from('city_segments')
      .update(updateData)
      .eq('id', segmentId)
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
      .single()
    
    if (segmentError) {
      logger.error('Error updating city segment', segmentError, { segmentId: getRouterParam(event, 'id') })
      if (segmentError.code === '23505') {
        throw createError({
          statusCode: 400,
          statusMessage: 'A city segment with this name already exists'
        })
      }
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update city segment'
      })
    }
    
    if (!segment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'City segment not found'
      })
    }
    
    // Transform data
    type CityRef = { id: string; name: string; order: number | null }
    const transformedSegment = {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      created_at: segment.created_at,
      updated_at: segment.updated_at,
      cities: segment.city_segment_cities
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
    handleApiError(error, 'PUT /api/admin/city-segments/[id]')
  }
})
