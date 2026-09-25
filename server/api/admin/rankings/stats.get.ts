import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const supabase = getSupabaseAdmin()

    // Get all active players with their ratings
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select(`
        id,
        elo,
        total_matches_played,
        placement_matches_completed,
        win_streak,
        loss_streak,
        matches_this_month,
        last_match_at,
        city_id,
        category_id,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('status', 'active')

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

    if (!players || players.length === 0) {
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
          loss_streaks: 0
        },
        players_at_decay_risk: 0,
        recent_ranking_changes: {
          last_7_days: 0,
          last_30_days: 0
        },
        players_at_elo_floor: 0,
        players_at_elo_ceiling: 0
      }
    }

    // Calculate basic statistics
    const ratedPlayers = players.filter(p => (p.total_matches_played || 0) > 0)
    const playersInPlacement = players.filter(p => 
      (p.total_matches_played || 0) === 0 || ((p.placement_matches_completed || 0) < 3)
    )

    const totalElo = players.reduce((sum, p) => sum + (p.elo || 0), 0)
    const averageElo = players.length > 0 ? Math.round(totalElo / players.length) : 0

    // Players by tier
    const playersByTier: Record<string, number> = {}
    const eloByTier: Record<string, number[]> = {}

    RATING_TIERS.forEach(tier => {
      playersByTier[tier.tier] = 0
      eloByTier[tier.tier] = []
    })

    players.forEach(player => {
      const tierInfo = getRatingTier(player.elo || 0)
      playersByTier[tierInfo.tier] = (playersByTier[tierInfo.tier] || 0) + 1
      eloByTier[tierInfo.tier].push(player.elo || 0)
    })

    // Average ELO by tier
    const averageEloByTier: Record<string, number> = {}
    Object.keys(eloByTier).forEach(tier => {
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
    players.forEach(player => {
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
        max: parseInt(range.split('-')[1])
      }))
      .sort((a, b) => a.min - b.min)

    // Tier distribution percentages
    const tierDistributionPercentages: Record<string, number> = {}
    const totalPlayers = players.length
    Object.keys(playersByTier).forEach(tier => {
      tierDistributionPercentages[tier] = totalPlayers > 0
        ? parseFloat(((playersByTier[tier] / totalPlayers) * 100).toFixed(2))
        : 0
    })

    // City-wise tier distribution
    const cityWiseTierDistribution: Record<string, Record<string, number>> = {}
    players.forEach(player => {
      const cityName = (player.city as any)?.name || 'Unknown'
      const tierInfo = getRatingTier(player.elo || 0)
      
      if (!cityWiseTierDistribution[cityName]) {
        cityWiseTierDistribution[cityName] = {}
        RATING_TIERS.forEach(t => {
          cityWiseTierDistribution[cityName][t.tier] = 0
        })
      }
      
      cityWiseTierDistribution[cityName][tierInfo.tier] = 
        (cityWiseTierDistribution[cityName][tierInfo.tier] || 0) + 1
    })

    // Category-wise tier distribution
    const categoryWiseTierDistribution: Record<string, Record<string, number>> = {}
    players.forEach(player => {
      const categoryName = (player.category as any)?.name || 'No Category'
      const tierInfo = getRatingTier(player.elo || 0)
      
      if (!categoryWiseTierDistribution[categoryName]) {
        categoryWiseTierDistribution[categoryName] = {}
        RATING_TIERS.forEach(t => {
          categoryWiseTierDistribution[categoryName][t.tier] = 0
        })
      }
      
      categoryWiseTierDistribution[categoryName][tierInfo.tier] = 
        (categoryWiseTierDistribution[categoryName][tierInfo.tier] || 0) + 1
    })

    // Players with active streaks
    const playersWithWinStreaks = players.filter(p => (p.win_streak || 0) > 0).length
    const playersWithLossStreaks = players.filter(p => (p.loss_streak || 0) > 0).length

    // Players at risk of decay (inactive this month)
    const now = new Date()
    const playersAtDecayRisk = players.filter(p => {
      const matchesThisMonth = p.matches_this_month || 0
      const isInPlacement = (p.total_matches_played || 0) === 0 || ((p.placement_matches_completed || 0) < 3)
      return !isInPlacement && matchesThisMonth < 2
    }).length

    // Recent ranking changes (check rating_history)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: recentChanges7Days } = await supabase
      .from('rating_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    const { count: recentChanges30Days } = await supabase
      .from('rating_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Players at ELO floor (500) and ceiling (4000+)
    const playersAtEloFloor = players.filter(p => (p.elo || 0) <= 500).length
    const playersAtEloCeiling = players.filter(p => (p.elo || 0) >= 4000).length

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
        loss_streaks: playersWithLossStreaks
      },
      players_at_decay_risk: playersAtDecayRisk,
      recent_ranking_changes: {
        last_7_days: recentChanges7Days || 0,
        last_30_days: recentChanges30Days || 0
      },
      players_at_elo_floor: playersAtEloFloor,
      players_at_elo_ceiling: playersAtEloCeiling
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
