import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { LeaderboardPlayer, BadgeType } from '~/types/leaderboard'
import type { City, Category } from '~/types'
import { leaderboardTopQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

type PlayerRow = {
  id: string
  name: string | null
  elo: number
  total_matches_played: number
  placement_matches_completed: number | null
  win_streak: number
  loss_streak: number
  previous_rank: number | null
  city: unknown
  category: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toCity(value: unknown): City | undefined {
  const r = asRecord(value)
  if (!r) return undefined
  return typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.order === 'number' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
    ? {
        id: r.id,
        name: r.name,
        order: r.order,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    : undefined
}

function toCategory(value: unknown): Category | undefined {
  const r = asRecord(value)
  if (!r) return undefined
  return typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.order === 'number' &&
    typeof r.default_elo === 'number' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
    ? {
        id: r.id,
        name: r.name,
        description: typeof r.description === 'string' ? r.description : undefined,
        order: r.order,
        default_elo: r.default_elo,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    : undefined
}

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
    const query = validateQuery(leaderboardTopQuerySchema, getQuery(event))
    const limit = query.limit ?? 10
    
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
        previous_rank,
        city:cities(id, name, order, created_at, updated_at),
        category:categories(id, name, description, order, default_elo, created_at, updated_at)
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
    const typedPlayers = (players || []) as unknown as PlayerRow[]
    const topPlayers: LeaderboardPlayer[] = typedPlayers.map((player, index) => {
      const tierInfo = getRatingTier(player.elo || 0)
      const rank = index + 1
      const badges = getPlayerBadges(rank, player.win_streak, player.total_matches_played)
      const isInPlacement = player.total_matches_played === 0 || (player.placement_matches_completed || 0) < 3
      
      // Check if player is close to next tier (within 100 ELO)
      // This works for both rated players and players in placement
      let isNearPromotion = false
      let nextTierName: string | null = null
      const tierProgress = getNextTierProgress(player.elo || 0)
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
        elo: player.elo || 0,
        rank,
        previous_rank: previousRank,
        rank_change: rankChange,
        rating_tier: tierInfo.tier, // Use ELO-based tier for all players
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: toCity(player.city),
        category: toCategory(player.category),
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
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/leaderboard/top')
  }
})
