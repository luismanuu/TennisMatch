import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const supabase = getSupabaseAdmin()

    // Build query with optional filters
    let queryBuilder = supabase
      .from('tournaments')
      .select(`
        *,
        category:categories(*),
        created_by_player:players!tournaments_created_by_fkey(*),
        organizer:players!tournaments_organizer_id_fkey(*)
      `)
      .order('start_date', { ascending: true })

    // Apply filters
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status)
    }

    if (query.category_id !== undefined) {
      if (query.category_id === null || query.category_id === 'null') {
        // Filter for tournaments without category (open to all)
        queryBuilder = queryBuilder.is('category_id', null)
      } else {
        queryBuilder = queryBuilder.eq('category_id', query.category_id)
      }
    }

    if (query.organizer_id) {
      queryBuilder = queryBuilder.eq('organizer_id', query.organizer_id)
    }

    if (query.start_date_from) {
      queryBuilder = queryBuilder.gte('start_date', query.start_date_from)
    }

    if (query.start_date_to) {
      queryBuilder = queryBuilder.lte('start_date', query.start_date_to)
    }

    if (query.search) {
      queryBuilder = queryBuilder.ilike('name', `%${query.search}%`)
    }

    // Only show upcoming and active tournaments by default (unless status filter is set)
    if (!query.status) {
      queryBuilder = queryBuilder.in('status', ['upcoming', 'active'])
    }

    const { data: tournaments, error } = await queryBuilder

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
        data: error
      })
    }

    return tournaments || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

