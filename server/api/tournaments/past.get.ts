import { getSupabaseAdmin } from '~/server/utils/supabase'
import { validateQuery, publicPastTournamentsListQuerySchema } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { PLAYER_SELECT_MIN, TOURNAMENT_SELECT_LIST } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(publicPastTournamentsListQuerySchema, getQuery(event))
    const supabase = getSupabaseAdmin()

    // Build query for completed tournaments
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
      .eq('status', 'completed')
      .order('end_date', { ascending: false })

    let countQuery = supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')

    // Apply optional filters
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

    if (query.search) {
      queryBuilder = queryBuilder.ilike('name', `%${query.search}%`)
      countQuery = countQuery.ilike('name', `%${query.search}%`)
    }

    const { count, error: countError } = await countQuery
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch past tournaments count',
        data: countError,
      })
    }

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    const { data: tournaments, error } = await queryBuilder.range(offset, offset + limit - 1)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch past tournaments',
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
    handleApiError(error, 'GET /api/tournaments/past')
  }
})

