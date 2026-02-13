import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import type { RemoveCityFromSegmentPayload } from '~/types'
import { adminCitySegmentRemoveCityQuerySchema, uuidSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const segmentId = validateParam(uuidSchema, getRouterParam(event, 'id'))
    const query = validateQuery(adminCitySegmentRemoveCityQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const cityId = query.city_id
    
    // Verify admin
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Remove city from segment
    const { error: deleteError } = await supabase
      .from('city_segment_cities')
      .delete()
      .eq('city_segment_id', segmentId)
      .eq('city_id', cityId)
    
    if (deleteError) {
      logger.error('Error removing city from segment', deleteError, { segmentId: getRouterParam(event, 'id') })
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
    type CityRef = { id: string; name: string; order: number | null }
    const transformedSegment = {
      id: updatedSegment.id,
      name: updatedSegment.name,
      description: updatedSegment.description,
      created_at: updatedSegment.created_at,
      updated_at: updatedSegment.updated_at,
      cities: updatedSegment.city_segment_cities
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
    handleApiError(error, 'DELETE /api/admin/city-segments/[id]/cities')
  }
})
