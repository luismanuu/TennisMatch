import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const tournamentId = getRouterParam(event, 'id')

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Get all tournament matches
    const { data: tournamentMatches, error: tmError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        match:matches(
          id,
          player1_id,
          player2_id,
          status,
          scheduled_at,
          played_at,
          score,
          winner_id
        )
      `)
      .eq('tournament_id', tournamentId)

    if (tmError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament matches',
        data: tmError
      })
    }

    return tournamentMatches || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

