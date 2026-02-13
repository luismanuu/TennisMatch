import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer } from '~/server/utils/organizer'
import { organizerTournamentsListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import type { PaginatedResponse } from '~/types'
import { handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event): Promise<PaginatedResponse<unknown>> => {
  try {
    const query = validateQuery(organizerTournamentsListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id

    await requireOrganizer(clerkId)

    const supabase = getSupabaseAdmin()

    // Get organizer's player ID
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()

    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }

    const limit = query.limit ?? 20
    const offset = query.offset ?? 0

    // Count tournaments created by this organizer
    const { count, error: countError } = await supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizer.id)

    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count tournaments',
        data: countError
      })
    }

    // Get tournaments created by this organizer (list view: keep it lightweight)
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        status,
        start_date,
        end_date,
        category_id,
        created_at,
        category:categories(id, name),
        registrations:tournament_registrations(id),
        groups:tournament_groups(id)
      `)
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
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
    handleApiError(error, 'GET /api/organizer/tournaments')
  }
})

