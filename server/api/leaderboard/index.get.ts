import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { RATING_TIERS, getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'
import type { LeaderboardPlayer, LeaderboardResponse, BadgeType } from '~/types/leaderboard'
import type { City, Category } from '~/types'
import { leaderboardQuerySchema, validateQuery } from '~/server/utils/validation'

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

export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
  try {
    const query = validateQuery(leaderboardQuerySchema, getQuery(event))
    
    // Parse query params (validated)
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id
    const search = query.search
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    const currentPlayerId = query.current_player_id
    const centerAroundPlayer = query.center_around_player ?? false
    
    const supabase = getSupabaseAdmin()

    // Determine additional filters
    let minElo: number | null = null
    let maxElo: number | null = null

    if (tier) {
      const tierInfo = RATING_TIERS.find(t => t.tier === tier)
      if (tierInfo) {
        minElo = tierInfo.minElo
        maxElo = Number.isFinite(tierInfo.maxElo) ? tierInfo.maxElo : null
      }
    }

    // If centering around player without a tier filter, constrain by ELO range (±200) using the current user's ELO
    let currentUserElo: number | null = null
    if (!tier && centerAroundPlayer && currentPlayerId) {
      const { data: currentPlayerRow, error: currentPlayerError } = await supabase
        .from('players')
        .select('id, elo')
        .eq('id', currentPlayerId)
        .eq('status', 'active')
        .single()

      if (!currentPlayerError && currentPlayerRow && typeof currentPlayerRow.elo === 'number') {
        currentUserElo = currentPlayerRow.elo
        minElo = currentPlayerRow.elo - 200
        maxElo = currentPlayerRow.elo + 200
      }
    }

    // Build base query (with DB-side pagination)
    let queryBuilder = supabase
      .from('players')
      .select(
        `
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
      `
      )
      .eq('status', 'active')

    if (cityId) queryBuilder = queryBuilder.eq('city_id', cityId)
    if (search && search.trim()) queryBuilder = queryBuilder.ilike('name', `%${search.trim()}%`)

    if (minElo !== null) queryBuilder = queryBuilder.gte('elo', minElo)
    if (maxElo !== null) queryBuilder = queryBuilder.lte('elo', maxElo)

    // Order by ELO descending (stable enough for now)
    queryBuilder = queryBuilder.order('elo', { ascending: false })

    // Count query (same filters)
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    if (cityId) countQuery = countQuery.eq('city_id', cityId)
    if (search && search.trim()) countQuery = countQuery.ilike('name', `%${search.trim()}%`)
    if (minElo !== null) countQuery = countQuery.gte('elo', minElo)
    if (maxElo !== null) countQuery = countQuery.lte('elo', maxElo)

    const { count: totalCount, error: countError } = await countQuery
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count leaderboard players',
        data: countError
      })
    }

    // If centering around player, compute an offset that centers them in the page (best-effort)
    let effectiveOffset = offset
    if (!tier && centerAroundPlayer && currentPlayerId && currentUserElo !== null) {
      const { count: higherCount, error: higherCountError } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gt('elo', currentUserElo)

      if (!higherCountError && typeof higherCount === 'number') {
        const half = Math.floor(limit / 2)
        effectiveOffset = Math.max(0, higherCount - half)
      }
    }

    const { data: players, error } = await queryBuilder.range(effectiveOffset, effectiveOffset + limit - 1)
    
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
        total: totalCount || 0,
        page: Math.floor(effectiveOffset / limit) + 1,
        page_size: limit,
        filters: { tier, city_id: cityId, search, limit, offset: effectiveOffset },
        current_user_position: null
      }
    }
    
    // Map players → leaderboard rows
    const typedPlayers = (players || []) as unknown as PlayerRow[]
    const allRankings: LeaderboardPlayer[] = typedPlayers.map((player, index) => {
      const tierInfo = getRatingTier(player.elo || 0)
      const isInPlacement = player.total_matches_played === 0 || (player.placement_matches_completed || 0) < 3
      // Use ELO-based tier for all players, regardless of placement status
      const playerTier = tierInfo.tier
      
      // Check if player is close to next tier (within 100 ELO)
      // This works for both rated players and players in placement
      let isNearPromotion = false
      let nextTierName: string | null = null
      const tierProgress = getNextTierProgress(player.elo || 0)
      if (!tierProgress.isMaxTier && tierProgress.eloNeeded <= 100) {
        isNearPromotion = true
        nextTierName = tierProgress.nextTier?.tier || null
      }
      
      const currentRank = effectiveOffset + index + 1
      const previousRank = player.previous_rank
      let rankChange: number | undefined = undefined
      if (previousRank !== null && previousRank !== undefined) {
        rankChange = previousRank - currentRank
      }

      return {
        id: player.id,
        name: player.name,
        elo: player.elo || 0,
        rank: currentRank,
        previous_rank: previousRank,
        rank_change: rankChange,
        rating_tier: playerTier,
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: toCity(player.city),
        category: toCategory(player.category),
        badges: getPlayerBadges(currentRank, player.win_streak, player.total_matches_played),
        is_current_user: currentPlayerId ? player.id === currentPlayerId : false,
        // Add promotion info
        near_promotion: isNearPromotion,
        next_tier: nextTierName
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })

    const currentUserPosition =
      currentPlayerId ? allRankings.find(p => p.id === currentPlayerId) || null : null
    
    return {
      success: true,
      rankings: allRankings,
      total: totalCount || 0,
      page: Math.floor(effectiveOffset / limit) + 1,
      page_size: limit,
      filters: { tier, city_id: cityId, search, limit, offset: effectiveOffset },
      current_user_position: currentUserPosition
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/leaderboard/index')
  }
})
