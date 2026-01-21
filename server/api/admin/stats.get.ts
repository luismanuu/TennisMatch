import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Get total active players
    const { count: activePlayersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get total deleted players
    const { count: deletedPlayersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'deleted')

    // Get pending players count
    const { count: pendingPlayersCount } = await supabase
      .from('pending_players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Get matches by status
    const { data: matchesByStatus } = await supabase
      .from('matches')
      .select('status')

    const matchesStats = {
      scheduled: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      total: 0
    }

    if (matchesByStatus) {
      matchesByStatus.forEach((match: any) => {
        matchesStats.total++
        if (match.status in matchesStats) {
          matchesStats[match.status as keyof typeof matchesStats]++
        }
      })
    }

    // Get category distribution
    const { data: playersByCategory } = await supabase
      .from('players')
      .select('category_id, category:categories(id, name)')
      .eq('status', 'active')

    const categoryDistribution: Record<string, number> = {}
    if (playersByCategory) {
      playersByCategory.forEach((player: any) => {
        const categoryName = player.category?.name || 'No Category'
        categoryDistribution[categoryName] = (categoryDistribution[categoryName] || 0) + 1
      })
    }

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: recentPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('created_at', sevenDaysAgo.toISOString())

    const { count: recentMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', sevenDaysAgo.toISOString())

    // Calculate match completion rate
    const completionRate = matchesStats.total > 0
      ? ((matchesStats.completed / matchesStats.total) * 100).toFixed(1)
      : '0'

    // Get tournament statistics
    const { data: tournamentsByStatus } = await supabase
      .from('tournaments')
      .select('status, id')

    const tournamentStats = {
      upcoming: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      total: 0
    }

    if (tournamentsByStatus) {
      tournamentsByStatus.forEach((tournament: any) => {
        tournamentStats.total++
        if (tournament.status in tournamentStats) {
          tournamentStats[tournament.status as keyof typeof tournamentStats]++
        }
      })
    }

    // Get total tournament registrations
    const { count: totalRegistrations } = await supabase
      .from('tournament_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .is('withdrawn_at', null)

    // Get unique organizers count
    const { data: organizersData } = await supabase
      .from('tournaments')
      .select('organizer_id')
      .not('organizer_id', 'is', null)

    const uniqueOrganizers = new Set()
    if (organizersData) {
      organizersData.forEach((t: any) => {
        if (t.organizer_id) {
          uniqueOrganizers.add(t.organizer_id)
        }
      })
    }

    // Calculate average registrations per tournament
    const avgRegistrations = tournamentStats.total > 0
      ? Math.round((totalRegistrations || 0) / tournamentStats.total)
      : 0

    // Get ranking statistics
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, elo, total_matches_played, placement_matches_completed')
      .eq('status', 'active')

    const ratedPlayers = allPlayers?.filter(p => (p.total_matches_played || 0) > 0) || []
    const playersInPlacement = allPlayers?.filter(p => 
      (p.total_matches_played || 0) === 0 || ((p.placement_matches_completed || 0) < 3)
    ) || []

    const totalElo = allPlayers?.reduce((sum, p) => sum + (p.elo || 0), 0) || 0
    const averageElo = allPlayers && allPlayers.length > 0 
      ? Math.round(totalElo / allPlayers.length) 
      : 0

    // Top 5 players by ELO with full details
    const { data: topPlayersData } = await supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        win_streak,
        loss_streak,
        placement_matches_completed,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('status', 'active')
      .order('elo', { ascending: false })
      .limit(5)

    const topPlayers = topPlayersData?.map(p => ({
      id: p.id,
      name: p.name,
      elo: p.elo || 0,
      tier: getRatingTier(p.elo || 0).tier,
      total_matches_played: p.total_matches_played || 0,
      win_streak: p.win_streak || 0,
      loss_streak: p.loss_streak || 0,
      placement_matches_completed: p.placement_matches_completed || 0,
      city: p.city as any,
      category: p.category as any
    })) || []

    // Tier distribution summary
    const tierDistribution: Record<string, number> = {}
    RATING_TIERS.forEach(tier => {
      tierDistribution[tier.tier] = 0
    })

    allPlayers?.forEach(player => {
      const tierInfo = getRatingTier(player.elo || 0)
      tierDistribution[tierInfo.tier] = (tierDistribution[tierInfo.tier] || 0) + 1
    })

    // Recent ranking changes (last 7 days)
    const { count: recentRankingChanges } = await supabase
      .from('rating_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    return {
      players: {
        active: activePlayersCount || 0,
        deleted: deletedPlayersCount || 0,
        pending: pendingPlayersCount || 0,
        total: (activePlayersCount || 0) + (deletedPlayersCount || 0)
      },
      matches: matchesStats,
      categoryDistribution,
      recentActivity: {
        newPlayers: recentPlayers || 0,
        completedMatches: recentMatches || 0
      },
      completionRate: parseFloat(completionRate),
      tournaments: {
        ...tournamentStats,
        totalRegistrations: totalRegistrations || 0,
        organizers: uniqueOrganizers.size,
        avgRegistrations
      },
      rankings: {
        total_rated_players: ratedPlayers.length,
        players_in_placement: playersInPlacement.length,
        average_elo: averageElo,
        top_5_players: topPlayers,
        tier_distribution: tierDistribution,
        recent_changes_7_days: recentRankingChanges || 0
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

