import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { LeaderboardPlayer, BadgeType } from '~/types/leaderboard'

// Helper to calculate badges for a player (disabled for now)
function getPlayerBadges(
  rank: number,
  winStreak: number,
  totalMatches: number
): BadgeType[] {
  return [] // Badges disabled
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 10, 50)
    
    const supabase = getSupabaseAdmin()
    
    // Get top N players (include all players, not just rated ones)
    const { data: players, error } = await supabase
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
      // Include all players
      .order('elo', { ascending: false })
      .limit(limit)
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch top players',
        data: error
      })
    }
    
    if (!players || players.length === 0) {
      return {
        success: true,
        top_players: [],
        total: 0
      }
    }
    
    // Map to LeaderboardPlayer format
    const topPlayers: LeaderboardPlayer[] = players.map((player, index) => {
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
      
      return {
        id: player.id,
        name: player.name,
        elo: player.elo,
        rank,
        rating_tier: tierInfo.tier, // Use ELO-based tier for all players
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: player.city as any,
        category: player.category as any,
        badges,
        is_current_user: false,
        near_promotion: isNearPromotion,
        next_tier: nextTierName
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })
    
    return {
      success: true,
      top_players: topPlayers,
      total: topPlayers.length
    }
  } catch (error: any) {
    console.error('Top players error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
