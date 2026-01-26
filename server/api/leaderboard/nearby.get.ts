import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { LeaderboardPlayer, NearbyPlayersResponse, BadgeType } from '~/types/leaderboard'

// Helper to calculate badges for a player (disabled for now)
function getPlayerBadges(
  rank: number,
  winStreak: number,
  totalMatches: number
): BadgeType[] {
  return [] // Badges disabled
}

export default defineEventHandler(async (event): Promise<NearbyPlayersResponse> => {
  try {
    const query = getQuery(event)
    const playerId = query.player_id as string
    const range = Math.min(query.range ? parseInt(query.range as string) : 5, 10)
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'player_id is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // First, get all players ordered by ELO (including placement players)
    const { data: allPlayers, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        win_streak,
        loss_streak,
        previous_rank,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('status', 'active')
      // Include all players, not just rated ones
      .order('elo', { ascending: false })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: error
      })
    }
    
    if (!allPlayers || allPlayers.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No players found'
      })
    }
    
    // Find the current player's index (position)
    const currentPlayerIndex = allPlayers.findIndex(p => p.id === playerId)
    
    if (currentPlayerIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found in rankings'
      })
    }
    
    // Map all players to LeaderboardPlayer format
    const rankedPlayers: LeaderboardPlayer[] = allPlayers.map((player, index) => {
      const tierInfo = getRatingTier(player.elo)
      const rank = index + 1
      const badges = getPlayerBadges(rank, player.win_streak, player.total_matches_played)
      const isInPlacement = player.total_matches_played === 0 || (player.placement_matches_completed || 0) < 3
      
      // Check if player is close to next tier (within 100 ELO)
      // This works for both rated players and players in placement
      let isNearPromotion = false
      let nextTierName: string | null = null
      const tierProgress = getNextTierProgress(player.elo)
      if (!tierProgress.isMaxTier && tierProgress.eloNeeded <= 100) {
        isNearPromotion = true
        nextTierName = tierProgress.nextTier?.tier || null
      }
      
      // Calculate rank change
      const previousRank = (player as any).previous_rank
      let rankChange: number | undefined = undefined
      if (previousRank !== null && previousRank !== undefined) {
        // rank_change = previous_rank - current_rank
        // Positive = moved up, Negative = moved down
        rankChange = previousRank - rank
      }
      
      return {
        id: player.id,
        name: player.name,
        elo: player.elo,
        rank,
        previous_rank: previousRank,
        rank_change: rankChange,
        rating_tier: tierInfo.tier, // Use ELO-based tier for all players
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: player.city as any,
        category: player.category as any,
        badges,
        is_current_user: player.id === playerId,
        near_promotion: isNearPromotion,
        next_tier: nextTierName
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })
    
    // Get the current player
    const currentPlayer = rankedPlayers[currentPlayerIndex]
    
    // Get players above (higher rank = lower index = higher ELO)
    const startAbove = Math.max(0, currentPlayerIndex - range)
    const playersAbove = rankedPlayers.slice(startAbove, currentPlayerIndex)
    
    // Get players below (lower rank = higher index = lower ELO)
    const endBelow = Math.min(rankedPlayers.length, currentPlayerIndex + range + 1)
    const playersBelow = rankedPlayers.slice(currentPlayerIndex + 1, endBelow)
    
    return {
      success: true,
      current_player: currentPlayer,
      players_above: playersAbove,
      players_below: playersBelow
    }
  } catch (error: any) {
    console.error('Nearby players error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
