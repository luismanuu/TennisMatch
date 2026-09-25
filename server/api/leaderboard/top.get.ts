import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { LeaderboardPlayer, BadgeType } from '~/types/leaderboard'

// Helper to calculate badges for a player (disabled for now)
function getPlayerBadges(rank: number, winStreak: number, totalMatches: number): BadgeType[] {
  return [] // Badges disabled
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 10, 50)

    const db = useDb()

    // Get top N players (include all players, not just rated ones)
    const rows = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      orderBy: [desc(players.elo), asc(players.id)],
      limit,
      columns: {
        id: true,
        name: true,
        elo: true,
        total_matches_played: true,
        placement_matches_completed: true,
        win_streak: true,
        loss_streak: true,
        previous_rank: true,
      },
      with: {
        city: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    })

    if (rows.length === 0) {
      return {
        success: true,
        top_players: [],
        total: 0,
      }
    }

    // Map to LeaderboardPlayer format
    const topPlayers: LeaderboardPlayer[] = rows.map((player, index) => {
      const tierInfo = getRatingTier(player.elo)
      const rank = index + 1
      const badges = getPlayerBadges(rank, player.win_streak ?? 0, player.total_matches_played ?? 0)

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
      const previousRank = player.previous_rank
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
        previous_rank: previousRank ?? undefined,
        rank_change: rankChange,
        rating_tier: tierInfo.tier, // Use ELO-based tier for all players
        total_matches_played: player.total_matches_played ?? 0,
        win_streak: player.win_streak ?? 0,
        loss_streak: player.loss_streak ?? 0,
        placement_matches_completed: player.placement_matches_completed ?? 0,
        city: player.city as any,
        category: player.category as any,
        badges,
        is_current_user: false,
        near_promotion: isNearPromotion,
        next_tier: nextTierName,
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })

    return {
      success: true,
      top_players: topPlayers,
      total: topPlayers.length,
    }
  } catch (error: any) {
    console.error('Top players error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
