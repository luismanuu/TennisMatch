import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 20
    const offset = parseInt(query.offset as string) || 0
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch rating history with opponent info
    const { data: history, error: historyError, count } = await supabase
      .from('rating_history')
      .select(`
        id,
        match_id,
        elo_before,
        elo_after,
        elo_change,
        mmr_before,
        mmr_after,
        mmr_change,
        k_factor,
        expected_score,
        actual_score,
        is_placement_match,
        is_unrated_match,
        win_streak_bonus,
        opponent_id,
        opponent_elo,
        was_winner,
        rating_reversed,
        created_at,
        opponent:players!rating_history_opponent_id_fkey(
          id,
          name,
          category:categories(id, name)
        )
      `, { count: 'exact' })
      .eq('player_id', playerId)
      .eq('rating_reversed', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (historyError) {
      console.error('Error fetching rating history:', historyError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history'
      })
    }
    
    // Calculate stats
    const wins = history?.filter(h => h.was_winner).length ?? 0
    const losses = history?.filter(h => !h.was_winner).length ?? 0
    const totalEloChange = history?.reduce((sum, h) => sum + h.elo_change, 0) ?? 0
    const peakElo = history?.length ? Math.max(...history.map(h => h.elo_after)) : 0
    
    return {
      success: true,
      history: history ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: (count ?? 0) > offset + limit,
      },
      stats: {
        wins,
        losses,
        win_rate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        total_elo_change: totalEloChange,
        peak_elo: peakElo,
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
