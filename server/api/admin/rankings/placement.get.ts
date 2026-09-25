import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const supabase = getSupabaseAdmin()

    // Get total count
    const { count, error: countError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or('total_matches_played.eq.0,placement_matches_completed.lt.3')
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count players in placement',
        data: countError
      })
    }

    // Get all players in placement matches
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        created_at,
        category:categories(id, name),
        city:cities(id, name)
      `)
      .eq('status', 'active')
      .or('total_matches_played.eq.0,placement_matches_completed.lt.3')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players in placement',
        data: playersError
      })
    }

    // Get placement match history for each player
    const playersWithHistory = await Promise.all(
      (players || []).map(async (player) => {
        const isInPlacement = (player.total_matches_played || 0) === 0 || 
          ((player.placement_matches_completed || 0) < 3)
        const placementMatchesRemaining = Math.max(0, 3 - (player.placement_matches_completed || 0))

        // Get rating history for placement matches
        const { data: placementHistory } = await supabase
          .from('rating_history')
          .select(`
            id,
            match_id,
            elo_before,
            elo_after,
            elo_change,
            created_at,
            is_placement_match,
            was_winner,
            opponent_id,
            match:matches(id, player1_id, player2_id, winner_id, score, played_at)
          `)
          .eq('player_id', player.id)
          .eq('is_placement_match', true)
          .order('created_at', { ascending: true })

        return {
          id: player.id,
          name: player.name,
          elo: player.elo || 0,
          total_matches_played: player.total_matches_played || 0,
          placement_matches_completed: player.placement_matches_completed || 0,
          placement_matches_remaining: placementMatchesRemaining,
          is_in_placement: isInPlacement,
          created_at: player.created_at,
          category: player.category,
          city: player.city,
          placement_history: placementHistory || []
        }
      })
    )

    // Calculate statistics (based on all players, not just current page)
    // We need to fetch all for stats, but this is expensive. For now, calculate from current page.
    // In production, you might want to cache these stats or calculate them separately.
    const stats = {
      total_in_placement: count || 0,
      completed_0: playersWithHistory.filter(p => p.placement_matches_completed === 0).length,
      completed_1: playersWithHistory.filter(p => p.placement_matches_completed === 1).length,
      completed_2: playersWithHistory.filter(p => p.placement_matches_completed === 2).length,
      average_elo: playersWithHistory.length > 0
        ? Math.round(playersWithHistory.reduce((sum, p) => sum + p.elo, 0) / playersWithHistory.length)
        : 0
    }

    return {
      success: true,
      players: playersWithHistory,
      statistics: stats,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
