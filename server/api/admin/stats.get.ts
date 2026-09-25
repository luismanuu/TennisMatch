import { and, asc, count, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, pending_players, players, rating_history, tournament_registrations, tournaments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const db = useDb()

    // Get total active players
    const [{ n: activePlayersCount }] = await db
      .select({ n: count() })
      .from(players)
      .where(and(eq(players.status, 'active'), isNull(players.deleted_at)))

    // Get total deleted players
    const [{ n: deletedPlayersCount }] = await db.select({ n: count() }).from(players).where(eq(players.status, 'deleted'))

    // Get pending players count
    const [{ n: pendingPlayersCount }] = await db.select({ n: count() }).from(pending_players).where(eq(pending_players.status, 'pending'))

    // Get matches by status
    const matchesByStatus = await db.select({ status: matches.status }).from(matches)

    const matchesStats = {
      scheduled: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    }

    if (matchesByStatus) {
      matchesByStatus.forEach((match) => {
        matchesStats.total++
        if (match.status in matchesStats) {
          matchesStats[match.status as keyof typeof matchesStats]++
        }
      })
    }

    // Get category distribution
    const playersByCategory = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: { category_id: true },
      with: { category: { columns: { id: true, name: true } } },
    })

    const categoryDistribution: Record<string, number> = {}
    if (playersByCategory) {
      playersByCategory.forEach((player) => {
        const categoryName = player.category?.name || 'No Category'
        categoryDistribution[categoryName] = (categoryDistribution[categoryName] || 0) + 1
      })
    }

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ n: recentPlayers }] = await db
      .select({ n: count() })
      .from(players)
      .where(and(eq(players.status, 'active'), isNull(players.deleted_at), gte(players.created_at, sevenDaysAgo)))

    const [{ n: recentMatches }] = await db
      .select({ n: count() })
      .from(matches)
      .where(and(eq(matches.status, 'completed'), gte(matches.updated_at, sevenDaysAgo)))

    // Calculate match completion rate
    const completionRate = matchesStats.total > 0 ? ((matchesStats.completed / matchesStats.total) * 100).toFixed(1) : '0'

    // Get tournament statistics
    const tournamentsByStatus = await db.select({ status: tournaments.status, id: tournaments.id }).from(tournaments)

    const tournamentStats = {
      upcoming: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    }

    if (tournamentsByStatus) {
      tournamentsByStatus.forEach((tournament) => {
        tournamentStats.total++
        if (tournament.status in tournamentStats) {
          tournamentStats[tournament.status as keyof typeof tournamentStats]++
        }
      })
    }

    // Get total tournament registrations
    const [{ n: totalRegistrations }] = await db
      .select({ n: count() })
      .from(tournament_registrations)
      .where(and(eq(tournament_registrations.status, 'confirmed'), isNull(tournament_registrations.withdrawn_at)))

    // Get unique organizers count
    const organizersData = await db
      .select({ organizer_id: tournaments.organizer_id })
      .from(tournaments)
      .where(isNotNull(tournaments.organizer_id))

    const uniqueOrganizers = new Set()
    if (organizersData) {
      organizersData.forEach((t) => {
        if (t.organizer_id) {
          uniqueOrganizers.add(t.organizer_id)
        }
      })
    }

    // Calculate average registrations per tournament
    const avgRegistrations = tournamentStats.total > 0 ? Math.round((totalRegistrations || 0) / tournamentStats.total) : 0

    // Get ranking statistics
    const allPlayers = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: { id: true, elo: true, total_matches_played: true, placement_matches_completed: true },
    })

    const ratedPlayers = allPlayers?.filter((p) => (p.total_matches_played || 0) > 0) || []
    const playersInPlacement = allPlayers?.filter((p) => (p.total_matches_played || 0) === 0 || (p.placement_matches_completed || 0) < 3) || []

    const totalElo = allPlayers?.reduce((sum, p) => sum + (p.elo || 0), 0) || 0
    const averageElo = allPlayers && allPlayers.length > 0 ? Math.round(totalElo / allPlayers.length) : 0

    // Top 5 players by ELO with full details
    const topPlayersData = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      orderBy: [desc(players.elo), asc(players.id)],
      limit: 5,
      columns: {
        id: true,
        name: true,
        elo: true,
        total_matches_played: true,
        win_streak: true,
        loss_streak: true,
        placement_matches_completed: true,
      },
      with: {
        city: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    })

    const topPlayers =
      topPlayersData?.map((p) => ({
        id: p.id,
        name: p.name,
        elo: p.elo || 0,
        tier: getRatingTier(p.elo || 0).tier,
        total_matches_played: p.total_matches_played || 0,
        win_streak: p.win_streak || 0,
        loss_streak: p.loss_streak || 0,
        placement_matches_completed: p.placement_matches_completed || 0,
        city: p.city as any,
        category: p.category as any,
      })) || []

    // Tier distribution summary
    const tierDistribution: Record<string, number> = {}
    RATING_TIERS.forEach((tier) => {
      tierDistribution[tier.tier] = 0
    })

    allPlayers?.forEach((player) => {
      const tierInfo = getRatingTier(player.elo || 0)
      tierDistribution[tierInfo.tier] = (tierDistribution[tierInfo.tier] || 0) + 1
    })

    // Recent ranking changes (last 7 days)
    const [{ n: recentRankingChanges }] = await db
      .select({ n: count() })
      .from(rating_history)
      .where(gte(rating_history.created_at, sevenDaysAgo))

    return {
      players: {
        active: activePlayersCount || 0,
        deleted: deletedPlayersCount || 0,
        pending: pendingPlayersCount || 0,
        total: (activePlayersCount || 0) + (deletedPlayersCount || 0),
      },
      matches: matchesStats,
      categoryDistribution,
      recentActivity: {
        newPlayers: recentPlayers || 0,
        completedMatches: recentMatches || 0,
      },
      completionRate: parseFloat(completionRate),
      tournaments: {
        ...tournamentStats,
        totalRegistrations: totalRegistrations || 0,
        organizers: uniqueOrganizers.size,
        avgRegistrations,
      },
      rankings: {
        total_rated_players: ratedPlayers.length,
        players_in_placement: playersInPlacement.length,
        average_elo: averageElo,
        top_5_players: topPlayers,
        tier_distribution: tierDistribution,
        recent_changes_7_days: recentRankingChanges || 0,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
