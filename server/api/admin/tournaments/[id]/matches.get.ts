import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

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

