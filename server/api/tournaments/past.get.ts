import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const supabase = getSupabaseAdmin()

    // Build query for completed tournaments
    let queryBuilder = supabase
      .from('tournaments')
      .select(`
        *,
        category:categories(*),
        created_by_player:players!tournaments_created_by_fkey(*),
        organizer:players!tournaments_organizer_id_fkey(*),
        registrations:tournament_registrations(
          *,
          player:players(*)
        )
      `)
      .eq('status', 'completed')
      .order('end_date', { ascending: false })

    // Apply optional filters
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

    if (query.search) {
      queryBuilder = queryBuilder.ilike('name', `%${query.search}%`)
    }

    const { data: tournaments, error } = await queryBuilder

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch past tournaments',
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

