import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'
import { validateRatingConsistency } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const supabase = getSupabaseAdmin()

    // Get all active players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, elo, total_matches_played, placement_matches_completed')
      .eq('status', 'active')

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

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
    const playersToCheck = players ? players.slice(0, 50) : []
    
    for (const player of playersToCheck) {
      if ((player.total_matches_played || 0) > 0) {
        const consistency = await validateRatingConsistency(player.id, supabase)
        if (!consistency.isConsistent) {
          consistencyChecks.push({
            player_id: player.id,
            player_name: player.name,
            is_consistent: consistency.isConsistent,
            expected_elo: consistency.expectedElo,
            actual_elo: consistency.actualElo,
            difference: Math.abs(consistency.expectedElo - consistency.actualElo)
          })
        }
      }
    }

    // Players with unusual ELO changes (check recent rating history)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentHistory, error: historyError } = await supabase
      .from('rating_history')
      .select('player_id, elo_change, created_at, player:players(id, name)')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    const unusualChanges: Array<{
      player_id: string
      player_name: string
      elo_change: number
      date: string
    }> = []

    if (recentHistory) {
      recentHistory.forEach(entry => {
        // Flag changes greater than 100 ELO as unusual
        if (Math.abs(entry.elo_change) > 100) {
          unusualChanges.push({
            player_id: entry.player_id,
            player_name: (entry.player as any)?.name || 'Unknown',
            elo_change: entry.elo_change,
            date: entry.created_at
          })
        }
      })
    }

    // Placement match completion rates
    const playersInPlacement = players?.filter(p => 
      (p.total_matches_played || 0) === 0 || ((p.placement_matches_completed || 0) < 3)
    ) || []

    const placementStats = {
      total_in_placement: playersInPlacement.length,
      completed_0: playersInPlacement.filter(p => (p.placement_matches_completed || 0) === 0).length,
      completed_1: playersInPlacement.filter(p => (p.placement_matches_completed || 0) === 1).length,
      completed_2: playersInPlacement.filter(p => (p.placement_matches_completed || 0) === 2).length,
      completion_rate: players?.length && players.length > 0
        ? parseFloat((((players.length - playersInPlacement.length) / players.length) * 100).toFixed(2))
        : 0
    }

    // Decay application status
    const { data: decayStatus, error: decayError } = await supabase
      .from('players')
      .select('id, matches_this_month, last_decay_check, total_matches_played, placement_matches_completed')
      .eq('status', 'active')
      .gte('total_matches_played', 1)

    const decayStats = {
      players_eligible: 0,
      players_at_risk: 0,
      players_exempt: 0,
      last_decay_check: null as string | null
    }

    if (decayStatus) {
      decayStatus.forEach(player => {
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
        .map(p => p.last_decay_check)
        .filter(Boolean)
        .sort()
        .reverse()
      
      if (lastChecks.length > 0) {
        decayStats.last_decay_check = lastChecks[0]
      }
    }

    // Rating calculation errors (check for matches without rating history)
    const { data: completedMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id, status, winner_id, played_at')
      .eq('status', 'completed')
      .not('winner_id', 'is', null)
      .gte('played_at', sevenDaysAgo.toISOString())

    const ratingErrors: Array<{
      match_id: string
      date: string
      issue: string
    }> = []

    if (completedMatches) {
      for (const match of completedMatches) {
        // Check if rating history exists for this match
        const { count: historyCount } = await supabase
          .from('rating_history')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id)

        if ((historyCount || 0) === 0) {
          ratingErrors.push({
            match_id: match.id,
            date: match.played_at || match.id,
            issue: 'No rating history found for completed match'
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

    const healthStatus = healthScore >= 80 ? 'healthy' : 
                         healthScore >= 60 ? 'warning' : 
                         'critical'

    return {
      health_score: healthScore,
      health_status: healthStatus,
      consistency_checks: {
        total_checked: playersToCheck.length,
        inconsistent: consistencyChecks.length,
        issues: consistencyChecks
      },
      unusual_elo_changes: {
        total: unusualChanges.length,
        changes: unusualChanges.slice(0, 20) // Limit to 20 most recent
      },
      placement_match_stats: placementStats,
      decay_stats: decayStats,
      rating_calculation_errors: {
        total: ratingErrors.length,
        errors: ratingErrors.slice(0, 20) // Limit to 20 most recent
      },
      recommendations: generateRecommendations({
        consistencyIssues: consistencyChecks.length,
        unusualChanges: unusualChanges.length,
        ratingErrors: ratingErrors.length,
        placementRate: placementStats.completion_rate,
        healthScore
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
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
