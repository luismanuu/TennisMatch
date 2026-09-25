import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier, getNextTierProgress, getMonthlyDecayStatus } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const playerId = getRouterParam(event, 'id')

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required',
      })
    }

    const db = useDb()

    // Get player data
    const player = await db.query.players.findFirst({
      where: and(eq(players.id, playerId), eq(players.status, 'active'), isNull(players.deleted_at)),
      columns: {
        id: true,
        name: true,
        elo: true,
        mmr: true,
        mmr_uncertainty: true,
        total_matches_played: true,
        placement_matches_completed: true,
        win_streak: true,
        loss_streak: true,
        matches_this_month: true,
        last_match_at: true,
        last_decay_check: true,
        created_at: true,
      },
      with: {
        category: { columns: { id: true, name: true, default_elo: true } },
        city: { columns: { id: true, name: true } },
      },
    })

    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
      })
    }

    // Get current ranking position
    const allPlayers = await db.query.players.findMany({
      where: and(eq(players.status, 'active'), isNull(players.deleted_at)),
      orderBy: [desc(players.elo), asc(players.id)],
      columns: { id: true, elo: true },
    })

    let currentRank = 1
    if (allPlayers) {
      const playerIndex = allPlayers.findIndex((p) => p.id === playerId)
      if (playerIndex !== -1) {
        currentRank = playerIndex + 1
      }
    }

    // Get rating history
    const ratingHistory = await db.query.rating_history.findMany({
      where: eq(rating_history.player_id, playerId),
      orderBy: [asc(rating_history.created_at)],
      columns: {
        id: true,
        match_id: true,
        elo_before: true,
        elo_after: true,
        elo_change: true,
        mmr_before: true,
        mmr_after: true,
        mmr_change: true,
        created_at: true,
        is_placement_match: true,
        is_unrated_match: true,
        win_streak_bonus: true,
        was_winner: true,
        opponent_id: true,
        opponent_elo: true,
      },
      with: {
        match: { columns: { id: true, player1_id: true, player2_id: true, winner_id: true, score: true, played_at: true } },
      },
    })

    // Calculate ranking position over time
    const rankingHistory: Array<{ date: string; rank: number; elo: number }> = []

    if (ratingHistory && ratingHistory.length > 0) {
      // Get all players' ELO at each point in time
      const allHistoryEntries = await db.query.rating_history.findMany({
        orderBy: [asc(rating_history.created_at)],
        columns: { player_id: true, elo_after: true, created_at: true },
      })

      if (allHistoryEntries) {
        // Group by date and calculate rankings
        const dateGroups: Record<string, Record<string, number>> = {}

        allHistoryEntries.forEach((entry) => {
          const dateKey = new Date(entry.created_at ?? 0).toISOString().split('T')[0]
          if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = {}
          }
          dateGroups[dateKey][entry.player_id] = entry.elo_after
        })

        // Calculate rank for each date where player had a change
        ratingHistory.forEach((entry) => {
          const dateKey = new Date(entry.created_at ?? 0).toISOString().split('T')[0]
          const elosOnDate = dateGroups[dateKey] || {}

          // Sort players by ELO on this date
          const sortedPlayers = Object.entries(elosOnDate).sort((a, b) => b[1] - a[1])

          const playerRank = sortedPlayers.findIndex(([id]) => id === playerId) + 1

          rankingHistory.push({
            date: dateKey,
            rank: playerRank || currentRank,
            elo: entry.elo_after,
          })
        })
      }
    }

    // Get tier information
    const tierInfo = getRatingTier(player.elo || 0)
    const tierProgress = getNextTierProgress(player.elo || 0)

    // Get monthly decay status (with proportional requirement if registered mid-month)
    const decayStatus = getMonthlyDecayStatus(
      player.matches_this_month || 0,
      player.last_decay_check,
      player.placement_matches_completed ?? undefined,
      player.created_at,
    )

    // Get recent match impact (last 10 matches)
    const recentMatches = ratingHistory ? ratingHistory.slice(-10).reverse() : []

    // Calculate ELO progression data for chart
    const eloProgression = ratingHistory
      ? ratingHistory.map((entry) => ({
          date: entry.created_at,
          elo: entry.elo_after,
          change: entry.elo_change,
        }))
      : []

    // Get placement match status
    const isInPlacement = (player.total_matches_played || 0) === 0 || (player.placement_matches_completed || 0) < 3
    const placementMatchesRemaining = Math.max(0, 3 - (player.placement_matches_completed || 0))

    // Get opponent information for recent matches
    const recentMatchDetails = await Promise.all(
      recentMatches.map(async (entry) => {
        if (entry.opponent_id) {
          const opponent = await db.query.players.findFirst({
            where: eq(players.id, entry.opponent_id),
            columns: { id: true, name: true, elo: true },
          })

          return {
            ...entry,
            opponent: opponent || null,
          }
        }
        return entry
      }),
    )

    return {
      player: {
        id: player.id,
        name: player.name,
        elo: player.elo,
        mmr: player.mmr,
        mmr_uncertainty: player.mmr_uncertainty,
        current_rank: currentRank,
        rating_tier: tierInfo.tier,
        tier_color: tierInfo.color,
        tier_progress: tierProgress,
        total_matches_played: player.total_matches_played || 0,
        placement_matches_completed: player.placement_matches_completed || 0,
        is_in_placement: isInPlacement,
        placement_matches_remaining: placementMatchesRemaining,
        win_streak: player.win_streak || 0,
        loss_streak: player.loss_streak || 0,
        matches_this_month: player.matches_this_month || 0,
        last_match_at: player.last_match_at,
        category: player.category,
        city: player.city,
        created_at: player.created_at,
      },
      decay_status: decayStatus,
      elo_progression: eloProgression,
      ranking_history: rankingHistory,
      recent_match_impact: recentMatchDetails,
      rating_history: ratingHistory || [],
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
