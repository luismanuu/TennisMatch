import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminListPaginationSchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { getOrSetTtlCache } from '~/server/utils/ttl-cache'

type PlacementPlayerRow = {
  id: string
  name: string | null
  elo: number | null
  total_matches_played: number | null
  placement_matches_completed: number | null
  created_at: string
  category: unknown
  city: unknown
}

type PlacementHistoryRow = {
  player_id: string
  [key: string]: unknown
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminListPaginationSchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const cacheKey = `admin:rankings:placement:v1:${offset}:${limit}`
    return await getOrSetTtlCache(cacheKey, 60_000, async () => {
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

    // Batch fetch placement match history for the current page of players (avoid N+1)
    const typedPlayers = (players || []) as unknown as PlacementPlayerRow[]
    const playerIds = typedPlayers.map((p) => p.id).filter(Boolean)
    let placementHistoryByPlayerId = new Map<string, PlacementHistoryRow[]>()

    if (playerIds.length > 0) {
      const { data: placementHistory, error: placementHistoryError } = await supabase
        .from('rating_history')
        .select(`
          id,
          player_id,
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
        .in('player_id', playerIds)
        .eq('is_placement_match', true)
        .order('created_at', { ascending: true })

      if (placementHistoryError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch placement match history',
          data: placementHistoryError
        })
      }

      placementHistoryByPlayerId = new Map()
      const typedHistory = (placementHistory || []) as unknown as PlacementHistoryRow[]
      for (const row of typedHistory) {
        const pid = row.player_id
        if (!pid) continue
        const existing = placementHistoryByPlayerId.get(pid) || []
        existing.push(row)
        placementHistoryByPlayerId.set(pid, existing)
      }
    }

    const playersWithHistory = typedPlayers.map((player) => {
      const isInPlacement =
        (player.total_matches_played || 0) === 0 || ((player.placement_matches_completed || 0) < 3)
      const placementMatchesRemaining = Math.max(0, 3 - (player.placement_matches_completed || 0))

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
        placement_history: placementHistoryByPlayerId.get(player.id) || []
      }
    })

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
    })
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/rankings/placement')
  }
})
