import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { getRatingTier, getNextTierProgress } from '~/server/utils/rating-system'
import type { LeaderboardPlayer, NearbyPlayersResponse, BadgeType } from '~/types/leaderboard'
import type { City, Category } from '~/types'
import { leaderboardNearbyQuerySchema, validateQuery } from '~/server/utils/validation'
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

export default defineEventHandler(async (event): Promise<NearbyPlayersResponse> => {
  try {
    const query = validateQuery(leaderboardNearbyQuerySchema, getQuery(event))
    const playerId = query.player_id
    const range = query.range ?? 5
    
    const supabase = getSupabaseAdmin()

    const { data: currentPlayerRow, error: currentPlayerError } = await supabase
      .from('players')
      .select('id, elo')
      .eq('id', playerId)
      .eq('status', 'active')
      .single()

    if (currentPlayerError || !currentPlayerRow) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    const playerElo = currentPlayerRow.elo

    // Compute player's rank position under stable ordering: (elo DESC, id ASC)
    const { count: higherCount, error: higherCountError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`elo.gt.${playerElo},and(elo.eq.${playerElo},id.lt.${playerId})`)

    if (higherCountError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to compute nearby players',
        data: higherCountError
      })
    }

    const effectiveOffset = Math.max(0, (higherCount ?? 0) - range)
    const windowLimit = range * 2 + 1

    const { data: windowPlayers, error: windowError } = await supabase
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
      .order('elo', { ascending: false })
      .order('id', { ascending: true })
      .range(effectiveOffset, effectiveOffset + windowLimit - 1)

    if (windowError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch nearby players',
        data: windowError
      })
    }

    const typedPlayers = (windowPlayers || []) as unknown as PlayerRow[]
    const rankedPlayers: LeaderboardPlayer[] = typedPlayers.map((player, index) => {
      const tierInfo = getRatingTier(player.elo || 0)
      const rank = effectiveOffset + index + 1
      const badges = getPlayerBadges(rank, player.win_streak, player.total_matches_played)

      let isNearPromotion = false
      let nextTierName: string | null = null
      const tierProgress = getNextTierProgress(player.elo || 0)
      if (!tierProgress.isMaxTier && tierProgress.eloNeeded <= 100) {
        isNearPromotion = true
        nextTierName = tierProgress.nextTier?.tier || null
      }

      const previousRank = player.previous_rank
      let rankChange: number | undefined = undefined
      if (previousRank !== null && previousRank !== undefined) {
        rankChange = previousRank - rank
      }

      return {
        id: player.id,
        name: player.name,
        elo: player.elo || 0,
        rank,
        previous_rank: previousRank,
        rank_change: rankChange,
        rating_tier: tierInfo.tier,
        total_matches_played: player.total_matches_played,
        win_streak: player.win_streak,
        loss_streak: player.loss_streak,
        placement_matches_completed: player.placement_matches_completed,
        city: toCity(player.city),
        category: toCategory(player.category),
        badges,
        is_current_user: player.id === playerId,
        near_promotion: isNearPromotion,
        next_tier: nextTierName
      } as LeaderboardPlayer & { near_promotion?: boolean; next_tier?: string | null }
    })

    const currentIndex = rankedPlayers.findIndex(p => p.id === playerId)
    const currentPlayer = currentIndex >= 0 ? rankedPlayers[currentIndex]! : rankedPlayers[0]!
    const playersAbove = currentIndex > 0 ? rankedPlayers.slice(0, currentIndex) : []
    const playersBelow = currentIndex >= 0 ? rankedPlayers.slice(currentIndex + 1) : rankedPlayers.slice(1)
    
    return {
      success: true,
      current_player: currentPlayer,
      players_above: playersAbove,
      players_below: playersBelow
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/leaderboard/nearby')
  }
})
