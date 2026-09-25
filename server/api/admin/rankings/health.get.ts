import { and, count, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, players, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { validateRatingConsistency } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const db = useDb()

    // Get all active players
    const allPlayers = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: { id: true, name: true, elo: true, total_matches_played: true, placement_matches_completed: true },
    })

    // Rating consistency checks
    const consistencyChecks: Array<{
      player_id: string
      player_name: string
      is_consistent: boolean
      expected_elo: number
      actual_elo: number
      difference: number
    }> = []

    // Sample check (first 50 players for performance, or all if less than 50)
    const playersToCheck = allPlayers ? allPlayers.slice(0, 50) : []

    for (const player of playersToCheck) {
      if ((player.total_matches_played || 0) > 0) {
        // validateRatingConsistency belongs to the matches batch; called with the cross-batch signature (playerId, tx?).
        const consistency = await validateRatingConsistency(player.id)
        if (!consistency.isConsistent) {
          consistencyChecks.push({
            player_id: player.id,
            player_name: player.name,
            is_consistent: consistency.isConsistent,
            expected_elo: consistency.expectedElo,
            actual_elo: consistency.actualElo,
            difference: Math.abs(consistency.expectedElo - consistency.actualElo),
          })
        }
      }
    }

    // Players with unusual ELO changes (check recent rating history)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentHistory = await db.query.rating_history.findMany({
      where: gte(rating_history.created_at, sevenDaysAgo),
      orderBy: [desc(rating_history.created_at)],
      columns: { player_id: true, elo_change: true, created_at: true },
      with: { player: { columns: { id: true, name: true } } },
    })

    const unusualChanges: Array<{
      player_id: string
      player_name: string
      elo_change: number
      date: string
    }> = []

    if (recentHistory) {
      recentHistory.forEach((entry) => {
        // Flag changes greater than 100 ELO as unusual
        if (Math.abs(entry.elo_change) > 100) {
          unusualChanges.push({
            player_id: entry.player_id,
            player_name: entry.player?.name || 'Unknown',
            elo_change: entry.elo_change,
            date: entry.created_at?.toISOString() ?? '',
          })
        }
      })
    }

    // Placement match completion rates
    const playersInPlacement =
      allPlayers?.filter((p) => (p.total_matches_played || 0) === 0 || (p.placement_matches_completed || 0) < 3) || []

    const placementStats = {
      total_in_placement: playersInPlacement.length,
      completed_0: playersInPlacement.filter((p) => (p.placement_matches_completed || 0) === 0).length,
      completed_1: playersInPlacement.filter((p) => (p.placement_matches_completed || 0) === 1).length,
      completed_2: playersInPlacement.filter((p) => (p.placement_matches_completed || 0) === 2).length,
      completion_rate:
        allPlayers?.length && allPlayers.length > 0
          ? parseFloat((((allPlayers.length - playersInPlacement.length) / allPlayers.length) * 100).toFixed(2))
          : 0,
    }

    // Decay application status
    const decayStatus = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at), gte(players.total_matches_played, 1)),
      columns: { id: true, matches_this_month: true, last_decay_check: true, total_matches_played: true, placement_matches_completed: true },
    })

    const decayStats = {
      players_eligible: 0,
      players_at_risk: 0,
      players_exempt: 0,
      last_decay_check: null as string | null,
    }

    if (decayStatus) {
      decayStatus.forEach((player) => {
        const isInPlacement = (player.placement_matches_completed || 0) < 3
        const matchesThisMonth = player.matches_this_month || 0

        if (!isInPlacement) {
          decayStats.players_eligible++
          if (matchesThisMonth < 2) {
            decayStats.players_at_risk++
          }
        } else {
          decayStats.players_exempt++
        }
      })

      // Get most recent decay check
      const lastChecks = decayStatus
        .map((p) => p.last_decay_check)
        .filter((d): d is string => Boolean(d))
        .sort()
        .reverse()

      if (lastChecks.length > 0) {
        decayStats.last_decay_check = lastChecks[0]
      }
    }

    // Rating calculation errors (check for matches without rating history)
    const completedMatches = await db.query.matches.findMany({
      where: and(eq(matches.status, 'completed'), isNotNull(matches.winner_id), gte(matches.played_at, sevenDaysAgo)),
      columns: { id: true, status: true, winner_id: true, played_at: true },
    })

    const ratingErrors: Array<{
      match_id: string
      date: string
      issue: string
    }> = []

    if (completedMatches) {
      for (const match of completedMatches) {
        // Check if rating history exists for this match
        const [{ n: historyCount }] = await db
          .select({ n: count() })
          .from(rating_history)
          .where(eq(rating_history.match_id, match.id))

        if ((historyCount || 0) === 0) {
          ratingErrors.push({
            match_id: match.id,
            date: match.played_at?.toISOString() || match.id,
            issue: 'No rating history found for completed match',
          })
        }
      }
    }

    // Overall health score (0-100)
    let healthScore = 100

    // Deduct points for issues
    if (consistencyChecks.length > 0) {
      healthScore -= Math.min(30, consistencyChecks.length * 2)
    }
    if (unusualChanges.length > 10) {
      healthScore -= Math.min(20, (unusualChanges.length - 10) * 1)
    }
    if (ratingErrors.length > 0) {
      healthScore -= Math.min(30, ratingErrors.length * 5)
    }
    if (placementStats.completion_rate < 50) {
      healthScore -= 10
    }

    healthScore = Math.max(0, healthScore)

    const healthStatus = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical'

    return {
      health_score: healthScore,
      health_status: healthStatus,
      consistency_checks: {
        total_checked: playersToCheck.length,
        inconsistent: consistencyChecks.length,
        issues: consistencyChecks,
      },
      unusual_elo_changes: {
        total: unusualChanges.length,
        changes: unusualChanges.slice(0, 20), // Limit to 20 most recent
      },
      placement_match_stats: placementStats,
      decay_stats: decayStats,
      rating_calculation_errors: {
        total: ratingErrors.length,
        errors: ratingErrors.slice(0, 20), // Limit to 20 most recent
      },
      recommendations: generateRecommendations({
        consistencyIssues: consistencyChecks.length,
        unusualChanges: unusualChanges.length,
        ratingErrors: ratingErrors.length,
        placementRate: placementStats.completion_rate,
        healthScore,
      }),
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})

function generateRecommendations(context: {
  consistencyIssues: number
  unusualChanges: number
  ratingErrors: number
  placementRate: number
  healthScore: number
}): string[] {
  const recommendations: string[] = []

  if (context.consistencyIssues > 0) {
    recommendations.push(`Found ${context.consistencyIssues} players with rating inconsistencies. Consider recalculating their ratings.`)
  }

  if (context.unusualChanges > 10) {
    recommendations.push(`Detected ${context.unusualChanges} unusual ELO changes in the last 7 days. Review recent matches for potential issues.`)
  }

  if (context.ratingErrors > 0) {
    recommendations.push(`Found ${context.ratingErrors} completed matches without rating history. These matches may need rating recalculation.`)
  }

  if (context.placementRate < 50) {
    recommendations.push(`Placement match completion rate is low (${context.placementRate.toFixed(1)}%). Consider reviewing placement match requirements.`)
  }

  if (context.healthScore < 60) {
    recommendations.push('System health is critical. Immediate attention required.')
  } else if (context.healthScore < 80) {
    recommendations.push('System health needs improvement. Review recommendations above.')
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operating normally. No action required.')
  }

  return recommendations
}
