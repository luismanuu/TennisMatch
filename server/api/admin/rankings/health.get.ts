import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { validateRatingConsistency } from '~/server/utils/rating-system'
import { clerkIdQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { getOrSetTtlCache } from '~/server/utils/ttl-cache'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let i = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await mapper(items[idx]!)
    }
  })

  await Promise.all(workers)
  return results
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id

    await requireAdmin(clerkId)

    // Cache the heavy computation briefly so admin navigation/refreshes are fast.
    // Note: per-process cache (Nitro node-server), safe short TTL.
    return await getOrSetTtlCache('admin:rankings:health:v1', 60_000, async () => {
      const supabase = getSupabaseAdmin()

      // Get all active players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name, elo, total_matches_played, placement_matches_completed, matches_this_month, last_decay_check')
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

      const consistencyTargets = playersToCheck.filter(p => (p.total_matches_played || 0) > 0)
      const consistencyResults = await mapWithConcurrency(
        consistencyTargets,
        5,
        async (player) => {
          const consistency = await validateRatingConsistency(player.id, supabase)
          return { player, consistency }
        }
      )

      for (const r of consistencyResults) {
        if (!r.consistency.isConsistent) {
          consistencyChecks.push({
            player_id: r.player.id,
            player_name: r.player.name,
            is_consistent: r.consistency.isConsistent,
            expected_elo: r.consistency.expectedElo,
            actual_elo: r.consistency.actualElo,
            difference: Math.abs(r.consistency.expectedElo - r.consistency.actualElo)
          })
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
          const playerRecord = asRecord((entry as { player?: unknown }).player)
          const playerName =
            playerRecord && typeof playerRecord['name'] === 'string'
              ? (playerRecord['name'] as string)
              : 'Unknown'
          unusualChanges.push({
            player_id: entry.player_id,
            player_name: playerName,
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

    const decayStats = {
      players_eligible: 0,
      players_at_risk: 0,
      players_exempt: 0,
      last_decay_check: null as string | null
    }

    if (players) {
      players.forEach(player => {
        const isRated = (player.total_matches_played || 0) >= 1
        const isInPlacement = (player.placement_matches_completed || 0) < 3
        const playerRecord = asRecord(player)
        const matchesThisMonth =
          playerRecord && typeof playerRecord['matches_this_month'] === 'number'
            ? (playerRecord['matches_this_month'] as number)
            : 0
        
        if (isRated && !isInPlacement) {
          decayStats.players_eligible++
          if (matchesThisMonth < 2) {
            decayStats.players_at_risk++
          }
        } else {
          decayStats.players_exempt++
        }
      })

      // Get most recent decay check
      const lastChecks = players
        .map((p) => {
          const pr = asRecord(p)
          return pr && typeof pr['last_decay_check'] === 'string' ? (pr['last_decay_check'] as string) : null
        })
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .sort()
        .reverse()
      
      if (lastChecks.length > 0) {
        decayStats.last_decay_check = lastChecks[0] ?? null
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

    if (completedMatches && completedMatches.length > 0) {
      const matchIds = completedMatches.map(m => m.id).filter(Boolean)
      const matchIdsWithHistory = new Set<string>()

      // Supabase `in()` has limits; chunk to stay safe
      const CHUNK_SIZE = 200
      for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
        const chunk = matchIds.slice(i, i + CHUNK_SIZE)
        const { data: historyRows, error: historyRowsError } = await supabase
          .from('rating_history')
          .select('match_id')
          .in('match_id', chunk)
          .eq('rating_reversed', false)

        if (historyRowsError) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch rating history for completed matches',
            data: historyRowsError
          })
        }

        const typedRows = (historyRows || []) as unknown as Array<{ match_id: string | null }>
        for (const row of typedRows) {
          if (typeof row.match_id === 'string' && row.match_id.length > 0) {
            matchIdsWithHistory.add(row.match_id)
          }
        }
      }

      for (const match of completedMatches) {
        if (!matchIdsWithHistory.has(match.id)) {
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
    })
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/rankings/health')
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
