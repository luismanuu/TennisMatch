import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier } from '~/server/utils/rating-system'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const matchId = getRouterParam(event, 'id')

    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }

    const supabase = getSupabaseAdmin()

    // Get match data
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        player1_id,
        player2_id,
        winner_id,
        score,
        played_at,
        status,
        player1:players!matches_player1_id_fkey(id, name, elo),
        player2:players!matches_player2_id_fkey(id, name, elo)
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found',
        data: matchError
      })
    }

    if (match.status !== 'completed' || !match.winner_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match must be completed with a winner to analyze impact'
      })
    }

    // Get rating history for both players for this match
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select(`
        id,
        player_id,
        elo_before,
        elo_after,
        elo_change,
        mmr_before,
        mmr_after,
        mmr_change,
        win_streak_bonus,
        was_winner,
        is_placement_match,
        created_at
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })

    if (historyError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history',
        data: historyError
      })
    }

    if (!ratingHistory || ratingHistory.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No rating history found for this match'
      })
    }

    // Get player data before and after match
    const player1History = ratingHistory.find(h => h.player_id === match.player1_id)
    const player2History = ratingHistory.find(h => h.player_id === match.player2_id)

    if (!player1History || !player2History) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Rating history incomplete for this match'
      })
    }

    // Get ranking positions before match (approximate - would need historical snapshot)
    // For now, we'll calculate based on ELO
    const { data: allPlayersBefore } = await supabase
      .from('players')
      .select('id, elo')
      .eq('status', 'active')
      .order('elo', { ascending: false })

    // Calculate approximate ranks
    const getRankForElo = (elo: number, players: any[]) => {
      return players.filter(p => p.elo > elo).length + 1
    }

    const player1RankBefore = allPlayersBefore 
      ? getRankForElo(player1History.elo_before, allPlayersBefore.map(p => ({ ...p, elo: p.id === match.player1_id ? player1History.elo_before : p.elo })))
      : null
    const player1RankAfter = allPlayersBefore
      ? getRankForElo(player1History.elo_after, allPlayersBefore.map(p => ({ ...p, elo: p.id === match.player1_id ? player1History.elo_after : p.elo })))
      : null

    const player2RankBefore = allPlayersBefore
      ? getRankForElo(player2History.elo_before, allPlayersBefore.map(p => ({ ...p, elo: p.id === match.player2_id ? player2History.elo_before : p.elo })))
      : null
    const player2RankAfter = allPlayersBefore
      ? getRankForElo(player2History.elo_after, allPlayersBefore.map(p => ({ ...p, elo: p.id === match.player2_id ? player2History.elo_after : p.elo })))
      : null

    // Check tier changes
    const player1TierBefore = getRatingTier(player1History.elo_before)
    const player1TierAfter = getRatingTier(player1History.elo_after)
    const player1TierChanged = player1TierBefore.tier !== player1TierAfter.tier

    const player2TierBefore = getRatingTier(player2History.elo_before)
    const player2TierAfter = getRatingTier(player2History.elo_after)
    const player2TierChanged = player2TierBefore.tier !== player2TierAfter.tier

    // Get win/loss streak impact
    const { data: player1Before } = await supabase
      .from('players')
      .select('win_streak, loss_streak')
      .eq('id', match.player1_id)
      .single()

    const { data: player2Before } = await supabase
      .from('players')
      .select('win_streak, loss_streak')
      .eq('id', match.player2_id)
      .single()

    // Get current streaks (after match)
    const { data: player1After } = await supabase
      .from('players')
      .select('win_streak, loss_streak')
      .eq('id', match.player1_id)
      .single()

    const { data: player2After } = await supabase
      .from('players')
      .select('win_streak, loss_streak')
      .eq('id', match.player2_id)
      .single()

    return {
      match: {
        id: match.id,
        player1: match.player1,
        player2: match.player2,
        winner_id: match.winner_id,
        score: match.score,
        played_at: match.played_at
      },
      player1_impact: {
        player: match.player1,
        elo_before: player1History.elo_before,
        elo_after: player1History.elo_after,
        elo_change: player1History.elo_change,
        mmr_before: player1History.mmr_before,
        mmr_after: player1History.mmr_after,
        mmr_change: player1History.mmr_change,
        rank_before: player1RankBefore,
        rank_after: player1RankAfter,
        rank_change: player1RankBefore && player1RankAfter ? player1RankBefore - player1RankAfter : null,
        tier_before: player1TierBefore.tier,
        tier_after: player1TierAfter.tier,
        tier_changed: player1TierChanged,
        win_streak_bonus: player1History.win_streak_bonus || 0,
        was_winner: player1History.was_winner,
        is_placement_match: player1History.is_placement_match,
        win_streak_before: player1Before?.win_streak || 0,
        win_streak_after: player1After?.win_streak || 0,
        loss_streak_before: player1Before?.loss_streak || 0,
        loss_streak_after: player1After?.loss_streak || 0
      },
      player2_impact: {
        player: match.player2,
        elo_before: player2History.elo_before,
        elo_after: player2History.elo_after,
        elo_change: player2History.elo_change,
        mmr_before: player2History.mmr_before,
        mmr_after: player2History.mmr_after,
        mmr_change: player2History.mmr_change,
        rank_before: player2RankBefore,
        rank_after: player2RankAfter,
        rank_change: player2RankBefore && player2RankAfter ? player2RankBefore - player2RankAfter : null,
        tier_before: player2TierBefore.tier,
        tier_after: player2TierAfter.tier,
        tier_changed: player2TierChanged,
        win_streak_bonus: player2History.win_streak_bonus || 0,
        was_winner: player2History.was_winner,
        is_placement_match: player2History.is_placement_match,
        win_streak_before: player2Before?.win_streak || 0,
        win_streak_after: player2After?.win_streak || 0,
        loss_streak_before: player2Before?.loss_streak || 0,
        loss_streak_after: player2After?.loss_streak || 0
      },
      summary: {
        total_elo_change: Math.abs(player1History.elo_change) + Math.abs(player2History.elo_change),
        tier_changes: (player1TierChanged ? 1 : 0) + (player2TierChanged ? 1 : 0),
        placement_matches: (player1History.is_placement_match ? 1 : 0) + (player2History.is_placement_match ? 1 : 0)
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
