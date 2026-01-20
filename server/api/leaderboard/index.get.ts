import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'
import type { LeaderboardPlayer, LeaderboardResponse, BadgeType } from '~/types/leaderboard'

// Helper to calculate badges for a player (disabled for now)
function getPlayerBadges(
  rank: number,
  winStreak: number,
  totalMatches: number
): BadgeType[] {
  return [] // Badges disabled
}

export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
  try {
    const query = getQuery(event)
    
    // Parse query params
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id as string | undefined
    const search = query.search as string | undefined
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 100)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    const currentPlayerId = query.current_player_id as string | undefined
    const centerAroundPlayer = query.center_around_player === 'true' // New param to center around current player
    
    const supabase = getSupabaseAdmin()
    
    // Build the query - include all players (rated and in placement)
    let queryBuilder = supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        win_streak,
        loss_streak,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('status', 'active')
      // Include all players, not just rated ones
    
    // Apply city filter
    if (cityId) {
      queryBuilder = queryBuilder.eq('city_id', cityId)
    }
    
    // Apply search filter (case-insensitive name search)
    if (search && search.trim()) {
      queryBuilder = queryBuilder.ilike('name', `%${search.trim()}%`)
    }
    
    // Order by ELO descending
    queryBuilder = queryBuilder.order('elo', { ascending: false })
    
    // Get total count for pagination (before applying tier filter which happens client-side)
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      // Include all players
    
    if (cityId) {
      countQuery = countQuery.eq('city_id', cityId)
    }
    
    if (search && search.trim()) {
      countQuery = countQuery.ilike('name', `%${search.trim()}%`)
    }
    
    const { count: totalCount } = await countQuery
    
    // Execute main query
    const { data: players, error } = await queryBuilder
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch leaderboard',
        data: error
      })
    }
    
    if (!players || players.length === 0) {
      return {
        success: true,
        rankings: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        filters: { tier, city_id: cityId, search, limit, offset },
        current_user_position: null
      }
    }
    
    // Calculate tiers for all players - use ELO-based tier for all players (including those in placement)
    let allRankings: LeaderboardPlayer[] = players.map((player, index) => {
      const tierInfo = getRatingTier(player.elo)
      const isInPlacement = player.total_matches_played === 0 || (player.placement_matches_completed || 0) < 3
      // Use ELO-based tier for all players, regardless of placement status
      const playerTier = tierInfo.tier
      
      // Check if player is close to next tier (within 100 ELO)
      // This works for both rated players and players in placement
      let isNearPromotion = false
      let nextTierName: string | null = null
      const tierProgress = getNextTierProgress(player.elo)
      if (!tierProgress.isMaxTier && tierProgress.eloNeeded <= 100) {
        isNearPromotion = true
        nextTierName = tierProgress.nextTier?.tier || null
      }
      
      return {
        id: player.id,
        name: player.name,
        elo: player.elo,
        rank: index + 1, // Temporary rank, will be recalculated after filtering
        rating_tier: playerTier,
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: player.city as any,
        category: player.category as any,
        badges: getPlayerBadges(index + 1, player.win_streak, player.total_matches_played),
        is_current_user: currentPlayerId ? player.id === currentPlayerId : false,
        // Add promotion info
        near_promotion: isNearPromotion,
        next_tier: nextTierName
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })
    
    // Find current user BEFORE filtering to get their ELO
    let currentUserElo: number | null = null
    if (currentPlayerId) {
      const userBeforeFilter = allRankings.find(p => p.id === currentPlayerId)
      if (userBeforeFilter) {
        currentUserElo = userBeforeFilter.elo
      }
    }
    
    // Apply tier filter BEFORE finding user position and recalculating ranks
    if (tier) {
      // Filter by specific tier (all players are now assigned tiers based on ELO)
      allRankings = allRankings.filter(p => p.rating_tier === tier)
    } else if (centerAroundPlayer && currentUserElo !== null) {
      // If no tier filter and centering around player, filter by ELO range (±200 ELO)
      // This ensures players see similar ELO players
      const eloRange = 200
      allRankings = allRankings.filter(p => {
        const eloDiff = Math.abs(p.elo - currentUserElo!)
        return eloDiff <= eloRange
      })
    }
    
    // Recalculate ranks after filtering (so ranks are 1, 2, 3... within the filtered results)
    allRankings = allRankings.map((player, index) => ({
      ...player,
      rank: index + 1
    }))
    
    // Find current user's position AFTER filtering
    let currentUserPosition: LeaderboardPlayer | null = null
    if (currentPlayerId) {
      currentUserPosition = allRankings.find(p => p.id === currentPlayerId) || null
    }
    
    // If centerAroundPlayer is true and we have a current player, center the view around them
    let paginatedRankings: LeaderboardPlayer[] = []
    if (centerAroundPlayer && currentUserPosition && currentPlayerId) {
      const playerIndex = allRankings.findIndex(p => p.id === currentPlayerId)
      if (playerIndex !== -1) {
        // Calculate range around the player
        const halfRange = Math.floor(limit / 2)
        const startIndex = Math.max(0, playerIndex - halfRange)
        const endIndex = Math.min(allRankings.length, startIndex + limit)
        const adjustedStartIndex = Math.max(0, endIndex - limit) // Adjust if we're near the end
        
        paginatedRankings = allRankings.slice(adjustedStartIndex, endIndex)
      } else {
        // Player not found in filtered results (wrong tier), return empty or first page
        paginatedRankings = allRankings.slice(0, limit)
      }
    } else {
      // Normal pagination
      paginatedRankings = allRankings.slice(offset, offset + limit)
    }
    
    return {
      success: true,
      rankings: paginatedRankings,
      total: tier ? allRankings.length : (totalCount || 0),
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: { tier, city_id: cityId, search, limit, offset },
      current_user_position: currentUserPosition
    }
  } catch (error: any) {
    console.error('Leaderboard error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
