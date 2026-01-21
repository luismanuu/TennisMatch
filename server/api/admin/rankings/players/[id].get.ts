import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getRatingTier, getNextTierProgress, getMonthlyDecayStatus } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const playerId = getRouterParam(event, 'id')

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Get player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        mmr,
        mmr_uncertainty,
        total_matches_played,
        placement_matches_completed,
        win_streak,
        loss_streak,
        matches_this_month,
        last_match_at,
        last_decay_check,
        created_at,
        category:categories(id, name, default_elo),
        city:cities(id, name)
      `)
      .eq('id', playerId)
      .eq('status', 'active')
      .single()

    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found',
        data: playerError
      })
    }

    // Get current ranking position
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, elo')
      .eq('status', 'active')
      .order('elo', { ascending: false })

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players for ranking',
        data: playersError
      })
    }

    let currentRank = 1
    if (allPlayers) {
      const playerIndex = allPlayers.findIndex(p => p.id === playerId)
      if (playerIndex !== -1) {
        currentRank = playerIndex + 1
      }
    }

    // Get rating history
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select(`
        id,
        match_id,
        elo_before,
        elo_after,
        elo_change,
        mmr_before,
        mmr_after,
        mmr_change,
        created_at,
        is_placement_match,
        is_unrated_match,
        win_streak_bonus,
        was_winner,
        opponent_id,
        opponent_elo,
        match:matches(id, player1_id, player2_id, winner_id, score, played_at)
      `)
      .eq('player_id', playerId)
      .order('created_at', { ascending: true })

    if (historyError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history',
        data: historyError
      })
    }

    // Calculate ranking position over time
    const rankingHistory: Array<{ date: string; rank: number; elo: number }> = []
    
    if (ratingHistory && ratingHistory.length > 0) {
      // Get all players' ELO at each point in time
      const allHistoryEntries = await supabase
        .from('rating_history')
        .select('player_id, elo_after, created_at')
        .order('created_at', { ascending: true })

      if (allHistoryEntries.data) {
        // Group by date and calculate rankings
        const dateGroups: Record<string, Record<string, number>> = {}
        
        allHistoryEntries.data.forEach(entry => {
          const dateKey = new Date(entry.created_at).toISOString().split('T')[0]
          if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = {}
          }
          dateGroups[dateKey][entry.player_id] = entry.elo_after
        })

        // Calculate rank for each date where player had a change
        ratingHistory.forEach(entry => {
          const dateKey = new Date(entry.created_at).toISOString().split('T')[0]
          const elosOnDate = dateGroups[dateKey] || {}
          
          // Sort players by ELO on this date
          const sortedPlayers = Object.entries(elosOnDate)
            .sort((a, b) => b[1] - a[1])
          
          const playerRank = sortedPlayers.findIndex(([id]) => id === playerId) + 1
          
          rankingHistory.push({
            date: dateKey,
            rank: playerRank || currentRank,
            elo: entry.elo_after
          })
        })
      }
    }

    // Get tier information
    const tierInfo = getRatingTier(player.elo || 0)
    const tierProgress = getNextTierProgress(player.elo || 0)

    // Get monthly decay status
    const decayStatus = getMonthlyDecayStatus(
      player.matches_this_month || 0,
      player.last_decay_check,
      player.placement_matches_completed
    )

    // Get recent match impact (last 10 matches)
    const recentMatches = ratingHistory
      ? ratingHistory.slice(-10).reverse()
      : []

    // Calculate ELO progression data for chart
    const eloProgression = ratingHistory
      ? ratingHistory.map(entry => ({
          date: entry.created_at,
          elo: entry.elo_after,
          change: entry.elo_change
        }))
      : []

    // Get placement match status
    const isInPlacement = (player.total_matches_played || 0) === 0 || 
      ((player.placement_matches_completed || 0) < 3)
    const placementMatchesRemaining = Math.max(0, 3 - (player.placement_matches_completed || 0))

    // Get opponent information for recent matches
    const recentMatchDetails = await Promise.all(
      recentMatches.map(async (entry) => {
        if (entry.opponent_id) {
          const { data: opponent } = await supabase
            .from('players')
            .select('id, name, elo')
            .eq('id', entry.opponent_id)
            .single()
          
          return {
            ...entry,
            opponent: opponent || null
          }
        }
        return entry
      })
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
        created_at: player.created_at
      },
      decay_status: decayStatus,
      elo_progression: eloProgression,
      ranking_history: rankingHistory,
      recent_match_impact: recentMatchDetails,
      rating_history: ratingHistory || []
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
