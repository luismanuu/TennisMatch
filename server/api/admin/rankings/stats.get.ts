import { and, count, eq, gte, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const db = useDb()

    // Get all active players with their ratings
    const players_ = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: {
        id: true,
        elo: true,
        total_matches_played: true,
        placement_matches_completed: true,
        win_streak: true,
        loss_streak: true,
        matches_this_month: true,
        last_match_at: true,
        city_id: true,
        category_id: true,
      },
      with: {
        city: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    })

    if (!players_ || players_.length === 0) {
      return {
        total_rated_players: 0,
        players_in_placement: 0,
        average_elo: 0,
        players_by_tier: {},
        average_elo_by_tier: {},
        elo_distribution: [],
        tier_distribution_percentages: {},
        city_wise_tier_distribution: {},
        category_wise_tier_distribution: {},
        players_with_streaks: {
          win_streaks: 0,
          loss_streaks: 0,
        },
        players_at_decay_risk: 0,
        recent_ranking_changes: {
          last_7_days: 0,
          last_30_days: 0,
        },
        players_at_elo_floor: 0,
        players_at_elo_ceiling: 0,
      }
    }

    // Calculate basic statistics
    const ratedPlayers = players_.filter((p) => (p.total_matches_played || 0) > 0)
    const playersInPlacement = players_.filter((p) => (p.total_matches_played || 0) === 0 || (p.placement_matches_completed || 0) < 3)

    const totalElo = players_.reduce((sum, p) => sum + (p.elo || 0), 0)
    const averageElo = players_.length > 0 ? Math.round(totalElo / players_.length) : 0

    // Players by tier
    const playersByTier: Record<string, number> = {}
    const eloByTier: Record<string, number[]> = {}

    RATING_TIERS.forEach((tier) => {
      playersByTier[tier.tier] = 0
      eloByTier[tier.tier] = []
    })

    players_.forEach((player) => {
      const tierInfo = getRatingTier(player.elo || 0)
      playersByTier[tierInfo.tier] = (playersByTier[tierInfo.tier] || 0) + 1
      eloByTier[tierInfo.tier].push(player.elo || 0)
    })

    // Average ELO by tier
    const averageEloByTier: Record<string, number> = {}
    Object.keys(eloByTier).forEach((tier) => {
      const elos = eloByTier[tier]
      if (elos.length > 0) {
        averageEloByTier[tier] = Math.round(elos.reduce((a, b) => a + b, 0) / elos.length)
      } else {
        averageEloByTier[tier] = 0
      }
    })

    // ELO distribution histogram (buckets of 500)
    const eloBuckets: Record<string, number> = {}
    const bucketSize = 500
    players_.forEach((player) => {
      const elo = player.elo || 0
      const bucket = Math.floor(elo / bucketSize) * bucketSize
      const bucketKey = `${bucket}-${bucket + bucketSize - 1}`
      eloBuckets[bucketKey] = (eloBuckets[bucketKey] || 0) + 1
    })

    const eloDistribution = Object.entries(eloBuckets)
      .map(([range, count]) => ({
        range,
        count,
        min: parseInt(range.split('-')[0]),
        max: parseInt(range.split('-')[1]),
      }))
      .sort((a, b) => a.min - b.min)

    // Tier distribution percentages
    const tierDistributionPercentages: Record<string, number> = {}
    const totalPlayers = players_.length
    Object.keys(playersByTier).forEach((tier) => {
      tierDistributionPercentages[tier] = totalPlayers > 0 ? parseFloat(((playersByTier[tier] / totalPlayers) * 100).toFixed(2)) : 0
    })

    // City-wise tier distribution
    const cityWiseTierDistribution: Record<string, Record<string, number>> = {}
    players_.forEach((player) => {
      const cityName = player.city?.name || 'Unknown'
      const tierInfo = getRatingTier(player.elo || 0)

      if (!cityWiseTierDistribution[cityName]) {
        cityWiseTierDistribution[cityName] = {}
        RATING_TIERS.forEach((t) => {
          cityWiseTierDistribution[cityName][t.tier] = 0
        })
      }

      cityWiseTierDistribution[cityName][tierInfo.tier] = (cityWiseTierDistribution[cityName][tierInfo.tier] || 0) + 1
    })

    // Category-wise tier distribution
    const categoryWiseTierDistribution: Record<string, Record<string, number>> = {}
    players_.forEach((player) => {
      const categoryName = player.category?.name || 'No Category'
      const tierInfo = getRatingTier(player.elo || 0)

      if (!categoryWiseTierDistribution[categoryName]) {
        categoryWiseTierDistribution[categoryName] = {}
        RATING_TIERS.forEach((t) => {
          categoryWiseTierDistribution[categoryName][t.tier] = 0
        })
      }

      categoryWiseTierDistribution[categoryName][tierInfo.tier] = (categoryWiseTierDistribution[categoryName][tierInfo.tier] || 0) + 1
    })

    // Players with active streaks
    const playersWithWinStreaks = players_.filter((p) => (p.win_streak || 0) > 0).length
    const playersWithLossStreaks = players_.filter((p) => (p.loss_streak || 0) > 0).length

    // Players at risk of decay (inactive this month)
    const playersAtDecayRisk = players_.filter((p) => {
      const matchesThisMonth = p.matches_this_month || 0
      const isInPlacement = (p.total_matches_played || 0) === 0 || (p.placement_matches_completed || 0) < 3
      return !isInPlacement && matchesThisMonth < 2
    }).length

    // Recent ranking changes (check rating_history)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [{ n: recentChanges7Days }] = await db
      .select({ n: count() })
      .from(rating_history)
      .where(gte(rating_history.created_at, sevenDaysAgo))

    const [{ n: recentChanges30Days }] = await db
      .select({ n: count() })
      .from(rating_history)
      .where(gte(rating_history.created_at, thirtyDaysAgo))

    // Players at ELO floor (500) and ceiling (4000+)
    const playersAtEloFloor = players_.filter((p) => (p.elo || 0) <= 500).length
    const playersAtEloCeiling = players_.filter((p) => (p.elo || 0) >= 4000).length

    return {
      total_rated_players: ratedPlayers.length,
      players_in_placement: playersInPlacement.length,
      average_elo: averageElo,
      players_by_tier: playersByTier,
      average_elo_by_tier: averageEloByTier,
      elo_distribution: eloDistribution,
      tier_distribution_percentages: tierDistributionPercentages,
      city_wise_tier_distribution: cityWiseTierDistribution,
      category_wise_tier_distribution: categoryWiseTierDistribution,
      players_with_streaks: {
        win_streaks: playersWithWinStreaks,
        loss_streaks: playersWithLossStreaks,
      },
      players_at_decay_risk: playersAtDecayRisk,
      recent_ranking_changes: {
        last_7_days: recentChanges7Days || 0,
        last_30_days: recentChanges30Days || 0,
      },
      players_at_elo_floor: playersAtEloFloor,
      players_at_elo_ceiling: playersAtEloCeiling,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
