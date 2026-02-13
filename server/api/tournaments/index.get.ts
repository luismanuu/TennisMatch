import { getSupabaseAdmin } from '~/server/utils/supabase'
import { validateQuery, publicTournamentsListQuerySchema } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { TOURNAMENT_SELECT_LIST, PLAYER_SELECT_MIN } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(publicTournamentsListQuerySchema, getQuery(event))
    const supabase = getSupabaseAdmin()

    // Build query with optional filters
    let queryBuilder = supabase
      .from('tournaments')
      .select(`
        ${TOURNAMENT_SELECT_LIST},
        category:categories(id, name),
        created_by_player:players!tournaments_created_by_fkey(${PLAYER_SELECT_MIN}),
        organizer:players!tournaments_organizer_id_fkey(${PLAYER_SELECT_MIN}),
        registrations:tournament_registrations(
          status,
          withdrawn_at
        )
      `)
      .order('start_date', { ascending: true })

    // Build count query (same filters, no range/order required)
    let countQuery = supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })

    // Apply filters
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status)
      countQuery = countQuery.eq('status', query.status)
    }

    if (query.category_id !== undefined) {
      if (query.category_id === 'null') {
        // Filter for tournaments without category (open to all)
        queryBuilder = queryBuilder.is('category_id', null)
        countQuery = countQuery.is('category_id', null)
      } else {
        queryBuilder = queryBuilder.eq('category_id', query.category_id)
        countQuery = countQuery.eq('category_id', query.category_id)
      }
    }

    if (query.organizer_id) {
      queryBuilder = queryBuilder.eq('organizer_id', query.organizer_id)
      countQuery = countQuery.eq('organizer_id', query.organizer_id)
    }

    if (query.start_date_from) {
      queryBuilder = queryBuilder.gte('start_date', query.start_date_from)
      countQuery = countQuery.gte('start_date', query.start_date_from)
    }

    if (query.start_date_to) {
      queryBuilder = queryBuilder.lte('start_date', query.start_date_to)
      countQuery = countQuery.lte('start_date', query.start_date_to)
    }

    if (query.search) {
      queryBuilder = queryBuilder.ilike('name', `%${query.search}%`)
      countQuery = countQuery.ilike('name', `%${query.search}%`)
    }

    // Only show upcoming and active tournaments by default (unless status filter is set)
    if (!query.status) {
      queryBuilder = queryBuilder.in('status', ['upcoming', 'active'])
      countQuery = countQuery.in('status', ['upcoming', 'active'])
    }

    const { count, error: countError } = await countQuery
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments count',
        data: countError,
      })
    }

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    const { data: tournaments, error } = await queryBuilder.range(offset, offset + limit - 1)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
        data: error
      })
    }

    return {
      data: tournaments || [],
      total: count ?? 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/tournaments/index')
  }
})

