import { getSupabaseAdmin } from '~/server/utils/supabase'
import { checkIsAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    
    if (!clerkId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'clerk_id is required'
      })
    }
    
    // Verify admin
    await checkIsAdmin(clerkId)
    
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
      console.error('Error fetching city segments:', segmentsError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch city segments'
      })
    }
    
    // Transform data to include cities array directly
    const transformedSegments = segments?.map(segment => ({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      created_at: segment.created_at,
      updated_at: segment.updated_at,
      cities: segment.city_segment_cities
        ?.map((csc: any) => csc.city)
        .filter(Boolean)
        .sort((a: any, b: any) => a.order - b.order) ?? [],
    })) ?? []
    
    return {
      success: true,
      segments: transformedSegments,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
