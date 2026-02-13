import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import { adminListPaginationSchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminListPaginationSchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('city_segments')
      .select('id', { count: 'exact', head: true })
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count city segments',
        data: countError
      })
    }
    
    // Fetch all city segments with their cities
    const { data: segments, error: segmentsError } = await supabase
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
      .order('name')
      .range(offset, offset + limit - 1)
    
    if (segmentsError) {
      logger.error('Error fetching city segments', segmentsError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch city segments'
      })
    }
    
    // Transform data to include cities array directly
    type CityRef = { id: string; name: string; order: number | null }
    const transformedSegments = segments?.map(segment => ({
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
    })) ?? []
    
    return {
      success: true,
      segments: transformedSegments,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/city-segments/index')
  }
})
