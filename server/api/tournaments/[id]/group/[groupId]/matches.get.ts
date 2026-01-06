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

    // Get group matches - First get tournament_matches
    const { data: tournamentMatches, error: tmError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        group:tournament_groups(
          id,
          group_name,
          group_number
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .eq('bracket_type', 'group')
      .order('round_number', { ascending: true })
      .order('id', { ascending: true })

    if (tmError) {
      console.error('Error fetching tournament matches:', {
        message: tmError.message,
        details: tmError.details,
        hint: tmError.hint,
        code: tmError.code,
        tournamentId,
        groupId
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament matches',
        data: tmError
      })
    }

    if (!tournamentMatches || tournamentMatches.length === 0) {
      return []
    }

    // Get match IDs
    const matchIds = tournamentMatches.map(tm => tm.match_id).filter(Boolean)

    if (matchIds.length === 0) {
      return tournamentMatches.map(tm => ({
        ...tm,
        match: null
      }))
    }

    // Get matches with player details
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
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
      `)
      .in('id', matchIds)

    if (matchesError) {
      console.error('Error fetching matches:', {
        message: matchesError.message,
        details: matchesError.details,
        hint: matchesError.hint,
        code: matchesError.code
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches',
        data: matchesError
      })
    }

    // Combine tournament_matches with match data
    const result = tournamentMatches.map(tm => {
      const match = matches?.find(m => m.id === tm.match_id)
      return {
        ...tm,
        match: match || null
      }
    })

    return result
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

