import { and, eq, gte, inArray, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, matches, players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'
import {
  getRatingTier,
  getExpectedWinProbability,
  isPlayerUnrated,
  eloToMmr,
  RATING_TIERS,
} from '~/server/utils/rating-system'
import type { MatchmakingRecommendation, Player, RatingTier } from '~/types'

// ============================================
// OPTIMIZED MATCHMAKING ALGORITHM
// ============================================
// Performance optimizations implemented:
// 1. Single batch query for monthly match counts (eliminates N+1 problem)
// 2. ELO range filter at database level
// 3. Parallelized independent queries
// 4. Date calculations moved outside loops
// ============================================

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 20 // Increased default for pagination
    const page = parseInt(query.page as string) || 1
    const offset = (page - 1) * limit

    const db = useDb()

    // ============================================
    // STEP 1: Get current player
    // ============================================
    const currentPlayer = await db.query.players.findFirst({
      where: and(eq(players.user_id, user.id), eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: {
        id: true,
        name: true,
        elo: true,
        mmr: true,
        mmr_uncertainty: true,
        city_id: true,
        category_id: true,
        total_matches_played: true,
        last_match_at: true,
      },
      with: {
        category: { columns: { id: true, name: true, order: true, default_elo: true } },
      },
    })

    if (!currentPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
      })
    }

    // Player must have a city for matchmaking
    if (!currentPlayer.city_id) {
      return {
        success: true,
        recommendations: [],
        message: 'Configura tu ciudad en tu perfil para encontrar oponentes en tu área',
      }
    }

    // ============================================
    // STEP 2: Get city segments and cities
    // ============================================
    // Get segments containing player's city, then get all cities in those segments
    const citySegments = await db
      .select({ city_segment_id: city_segment_cities.city_segment_id })
      .from(city_segment_cities)
      .where(eq(city_segment_cities.city_id, currentPlayer.city_id))

    // If no city segments, return empty
    if (!citySegments || citySegments.length === 0) {
      return {
        success: true,
        recommendations: [],
        message: 'No hay región de matchmaking configurada para tu ciudad. Por favor contacta a un administrador.',
      }
    }

    const segmentIds = citySegments.map((s) => s.city_segment_id)

    // Get all cities in these segments
    const segmentCities = await db
      .select({ city_id: city_segment_cities.city_id })
      .from(city_segment_cities)
      .where(inArray(city_segment_cities.city_segment_id, segmentIds))

    const matchableCityIds = [...new Set(segmentCities?.map((c) => c.city_id) || [])]

    // ============================================
    // STEP 3: Calculate ELO range for filtering
    // ============================================
    const currentIsUnrated = isPlayerUnrated(currentPlayer.total_matches_played ?? 0)
    const categoryDefaultElo = currentPlayer.category?.default_elo ?? 1000
    const currentEffectiveElo = currentIsUnrated ? categoryDefaultElo : currentPlayer.elo

    // Get current player's tier
    const currentTierInfo = getRatingTier(currentEffectiveElo)
    const currentTierIndex = RATING_TIERS.findIndex((t) => t.tier === currentTierInfo.tier)

    // Calculate allowed tier range: 2 tiers above, same tier, 1 tier below
    const minTierIndex = Math.max(0, currentTierIndex - 1)
    const maxTierIndex = Math.min(RATING_TIERS.length - 1, currentTierIndex + 2)

    const minAllowedElo = RATING_TIERS[minTierIndex].minElo
    const maxAllowedElo = RATING_TIERS[maxTierIndex].maxElo === Infinity ? 10000 : RATING_TIERS[maxTierIndex].maxElo

    // ============================================
    // STEP 4: Pre-calculate date boundaries (MOVED OUTSIDE LOOP)
    // ============================================
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // ============================================
    // STEP 5: Fetch players WITH ELO filter at DB level
    // ============================================
    const candidatePlayers = await db.query.players.findMany({
      where: and(
        eq(players.status, 'active'),
        isNull(players.deleted_at),
        ne(players.id, currentPlayer.id),
        inArray(players.city_id, matchableCityIds),
        gte(players.elo, minAllowedElo),
        lte(players.elo, maxAllowedElo),
      ),
      orderBy: [sql`${players.last_match_at} desc nulls last`],
      limit: 500, // Fetch up to 500 for better pagination support
      columns: {
        id: true,
        name: true,
        elo: true,
        mmr: true,
        city_id: true,
        category_id: true,
        total_matches_played: true,
        last_match_at: true,
      },
      with: {
        category: { columns: { id: true, name: true, order: true, default_elo: true } },
        city: { columns: { id: true, name: true } },
      },
    })

    let recommendations: MatchmakingRecommendation[] = []

    if (candidatePlayers && candidatePlayers.length > 0) {
      // ============================================
      // STEP 6: BATCH QUERY for monthly match counts
      // Single query instead of N+1 queries
      // ============================================
      const playerIds = candidatePlayers.map((p) => p.id)

      // Fetch all matches involving current player this month in ONE query
      // Use two separate queries and combine results to avoid .or() filter conflicts
      const [matchesAsPlayer1, matchesAsPlayer2] = await Promise.all([
        db
          .select({ player1_id: matches.player1_id, player2_id: matches.player2_id })
          .from(matches)
          .where(
            and(
              eq(matches.status, 'completed'),
              eq(matches.player1_id, currentPlayer.id),
              gte(matches.played_at, firstDayOfMonth),
              lt(matches.played_at, firstDayOfNextMonth),
            ),
          ),
        db
          .select({ player1_id: matches.player1_id, player2_id: matches.player2_id })
          .from(matches)
          .where(
            and(
              eq(matches.status, 'completed'),
              eq(matches.player2_id, currentPlayer.id),
              gte(matches.played_at, firstDayOfMonth),
              lt(matches.played_at, firstDayOfNextMonth),
            ),
          ),
      ])

      // Combine results from both queries
      const monthlyMatches = [...matchesAsPlayer1, ...matchesAsPlayer2]

      // Build a map of opponent -> match count
      const matchCountMap = new Map<string, number>()
      for (const match of monthlyMatches) {
        // Determine who the opponent is
        const opponentId = match.player1_id === currentPlayer.id ? match.player2_id : match.player1_id

        // Only count if opponent is in our potential player list
        if (opponentId && playerIds.includes(opponentId)) {
          matchCountMap.set(opponentId, (matchCountMap.get(opponentId) || 0) + 1)
        }
      }

      // ============================================
      // STEP 7: Filter and transform to recommendations
      // ============================================
      const currentEffectiveMmr = currentIsUnrated ? eloToMmr(categoryDefaultElo) : Number(currentPlayer.mmr)

      const eligiblePlayers = candidatePlayers.filter((player) => {
        // Check: haven't played 4+ times this month
        const matchesWithOpponent = matchCountMap.get(player.id) || 0
        if (matchesWithOpponent >= 4) return false

        // Check: filter by effective ELO within tier range (for unrated players)
        const playerIsUnrated = isPlayerUnrated(player.total_matches_played ?? 0)
        if (playerIsUnrated) {
          const playerEffectiveElo = player.category?.default_elo ?? 1000
          if (playerEffectiveElo < minAllowedElo || playerEffectiveElo > maxAllowedElo) {
            return false
          }
        }

        return true
      })

      // Convert to recommendations
      recommendations = eligiblePlayers.map((player) => {
        const playerIsUnrated = isPlayerUnrated(player.total_matches_played ?? 0)
        const playerDefaultElo = player.category?.default_elo ?? 1000
        const playerEffectiveElo = playerIsUnrated ? playerDefaultElo : player.elo
        const playerEffectiveMmr = playerIsUnrated ? eloToMmr(playerDefaultElo) : Number(player.mmr)

        // Calculate expected win probability
        const expectedWinProb = getExpectedWinProbability(currentEffectiveElo, playerEffectiveElo)

        // Calculate MMR difference
        const mmrDiff = Math.abs(currentEffectiveMmr - playerEffectiveMmr)

        // Get rating tier
        const tier = playerIsUnrated ? ('Unrated' as RatingTier) : getRatingTier(playerEffectiveElo).tier

        // Calculate days since last active
        let lastActiveDaysAgo: number | undefined
        if (player.last_match_at) {
          const lastMatch = new Date(player.last_match_at)
          lastActiveDaysAgo = Math.floor((now.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24))
        }

        return {
          player: {
            id: player.id,
            name: player.name,
            elo: player.elo,
            mmr: Number(player.mmr),
            city_id: player.city_id,
            city: player.city,
            category_id: player.category_id,
            category: player.category,
            total_matches_played: player.total_matches_played,
            last_match_at: player.last_match_at,
          } as unknown as Player,
          expected_win_probability: expectedWinProb,
          mmr_difference: mmrDiff,
          rating_tier: tier,
          is_unrated: playerIsUnrated,
          last_active_days_ago: lastActiveDaysAgo,
        } as MatchmakingRecommendation
      })

      // ============================================
      // STEP 8: Sort recommendations
      // ============================================
      recommendations.sort((a, b) => {
        // Prefer matching unrated with unrated
        if (currentIsUnrated) {
          if (a.is_unrated && !b.is_unrated) return -1
          if (!a.is_unrated && b.is_unrated) return 1
        }

        // Then by MMR proximity
        const mmrDiffA = a.mmr_difference
        const mmrDiffB = b.mmr_difference
        if (Math.abs(mmrDiffA - mmrDiffB) > 0.1) {
          return mmrDiffA - mmrDiffB
        }

        // Then by activity
        const daysA = a.last_active_days_ago ?? Infinity
        const daysB = b.last_active_days_ago ?? Infinity
        return daysA - daysB
      })

      // Separate top 5 recommendations (algorithm-based) from the rest
      const topRecommendations = recommendations.slice(0, 5)
      const restRecommendations = recommendations.slice(5)
      const totalCount = recommendations.length

      // Apply pagination
      let paginatedRecommendations: MatchmakingRecommendation[] = []
      if (page === 1) {
        // First page: show top 5 only
        paginatedRecommendations = topRecommendations
      } else {
        // Other pages: show paginated results from the rest (excluding top 5)
        const startIndex = (page - 2) * limit // page 2 starts at index 0 of restRecommendations
        paginatedRecommendations = restRecommendations.slice(startIndex, startIndex + limit)
      }

      // Calculate pagination info
      // Total pages = 1 (for top 5) + pages for the rest
      const restCount = restRecommendations.length
      const totalPages =
        restCount > 0
          ? Math.ceil(restCount / limit) + 1 // +1 for first page with top 5
          : 1 // Only top 5, no additional pages

      // Calculate currentTier for player_info (needed before return)
      const currentTier = currentIsUnrated ? ('Unrated' as RatingTier) : currentTierInfo.tier

      return {
        success: true,
        recommendations: paginatedRecommendations,
        top_recommendations: page === 1 ? topRecommendations : [], // Only return on first page
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: totalPages,
          has_more: page < totalPages,
          top_recommendations_count: topRecommendations.length,
        },
        player_info: {
          id: currentPlayer.id,
          name: currentPlayer.name,
          elo: currentPlayer.elo,
          mmr: Number(currentPlayer.mmr),
          rating_tier: currentTier,
          is_unrated: currentIsUnrated,
          city_id: currentPlayer.city_id,
        },
        search_info: {
          city_segments_count: segmentIds.length,
          matchable_cities_count: matchableCityIds.length,
          recommendations_count: totalCount,
        },
      }
    }

    // ============================================
    // STEP 9: Return response (no recommendations found)
    // ============================================
    const currentTier = currentIsUnrated ? ('Unrated' as RatingTier) : currentTierInfo.tier

    return {
      success: true,
      recommendations: [],
      top_recommendations: [],
      pagination: {
        page: 1,
        limit,
        total: 0,
        total_pages: 1,
        has_more: false,
        top_recommendations_count: 0,
      },
      player_info: {
        id: currentPlayer.id,
        name: currentPlayer.name,
        elo: currentPlayer.elo,
        mmr: Number(currentPlayer.mmr),
        rating_tier: currentTier,
        is_unrated: currentIsUnrated,
        city_id: currentPlayer.city_id,
      },
      search_info: {
        city_segments_count: segmentIds.length,
        matchable_cities_count: matchableCityIds.length,
        recommendations_count: 0,
      },
    }
  } catch (error: any) {
    console.error('Matchmaking error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
