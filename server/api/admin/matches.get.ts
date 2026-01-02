import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const status = query.status as string | undefined
    const playerId = query.player_id as string | undefined
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build query
    let queryBuilder = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status
        ),
        winner:players!winner_id(
          id,
          name,
          status
        )
      `)

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (playerId) {
      queryBuilder = queryBuilder.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    }

    if (startDate) {
      queryBuilder = queryBuilder.gte('scheduled_at', startDate)
    }

    if (endDate) {
      queryBuilder = queryBuilder.lte('scheduled_at', endDate)
    }

    const { data: matches, error: fetchError } = await queryBuilder
      .order('scheduled_at', { ascending: false })
      .limit(1000) // Limit to prevent performance issues

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches',
        data: fetchError
      })
    }

    return matches || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

