import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')
    const groupId = getRouterParam(event, 'groupId')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    if (!groupId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Get group matches
    const { data: matches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        match:matches(
          id,
          player1_id,
          player2_id,
          winner_id,
          status,
          score,
          scheduled_at,
          player1:players!matches_player1_id_fkey(id, name),
          player2:players!matches_player2_id_fkey(id, name),
          winner:players!matches_winner_id_fkey(id, name)
        ),
        group:tournament_groups(
          id,
          group_name,
          group_number
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .eq('bracket_type', 'group')
      .order('created_at', { ascending: true })

    if (matchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch group matches',
        data: matchesError
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

