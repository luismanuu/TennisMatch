import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminTournamentsListQuerySchema, validateQuery } from '~/server/utils/validation'
import { PLAYER_SELECT_MIN, TOURNAMENT_SELECT_LIST } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminTournamentsListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    
    // Pagination parameters
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build count query
    let countQuery = supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })

    // Build query with optional filters
    let queryBuilder = supabase
      .from('tournaments')
      .select(`
        ${TOURNAMENT_SELECT_LIST},
        category:categories(id, name),
        created_by_player:players!tournaments_created_by_fkey(${PLAYER_SELECT_MIN}),
        organizer:players!tournaments_organizer_id_fkey(${PLAYER_SELECT_MIN})
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status)
    }

    if (query.category_id !== undefined) {
      if (query.category_id === 'null') {
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
      countQuery = countQuery.ilike('name', `%${query.search}%`)
    }
    
    // Apply same filters to count query
    if (query.status) {
      countQuery = countQuery.eq('status', query.status)
    }
    if (query.category_id !== undefined) {
      if (query.category_id === null || query.category_id === 'null') {
        countQuery = countQuery.is('category_id', null)
      } else {
        countQuery = countQuery.eq('category_id', query.category_id)
      }
    }
    if (query.organizer_id) {
      countQuery = countQuery.eq('organizer_id', query.organizer_id)
    }
    if (query.start_date_from) {
      countQuery = countQuery.gte('start_date', query.start_date_from)
    }
    if (query.start_date_to) {
      countQuery = countQuery.lte('start_date', query.start_date_to)
    }

    // Get total count
    const { count, error: countError } = await countQuery
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count tournaments',
        data: countError
      })
    }

    // Apply pagination
    const { data: tournaments, error } = await queryBuilder
      .range(offset, offset + limit - 1)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
        data: error
      })
    }

    return {
      data: tournaments || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/tournaments/index')
  }
})

