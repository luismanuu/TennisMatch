/**
 * Admin endpoint to fix incorrect win streaks and total_matches_played
 * Recalculates these values from rating_history to ensure accuracy
 */

import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

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

    // Get all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, total_matches_played, win_streak')

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

    const results: Array<{
      player_id: string
      player_name: string
      old_total_matches: number
      new_total_matches: number
      old_win_streak: number
      new_win_streak: number
      fixed: boolean
    }> = []

    // Fix each player
    for (const player of players || []) {
      // Get rating history for this player (non-reversed, ordered by most recent first)
      const { data: history, error: historyError } = await supabase
        .from('rating_history')
        .select('was_winner, created_at')
        .eq('player_id', player.id)
        .eq('rating_reversed', false)
        .order('created_at', { ascending: false })

      if (historyError) {
        console.error(`Error fetching history for player ${player.id}:`, historyError)
        continue
      }

      // Calculate total matches (count distinct match_ids)
      // We need to get all match_ids and count unique ones
      const { data: matchIds, error: matchIdsError } = await supabase
        .from('rating_history')
        .select('match_id')
        .eq('player_id', player.id)
        .eq('rating_reversed', false)

      if (matchIdsError) {
        console.error(`Error fetching match IDs for player ${player.id}:`, matchIdsError)
        continue
      }

      // Count unique match_ids
      const uniqueMatchIds = new Set(matchIds?.map(m => m.match_id) || [])
      const newTotalMatches = uniqueMatchIds.size

      // Calculate current win streak from history
      let newWinStreak = 0
      if (history && history.length > 0) {
        // Current streak (from most recent)
        for (const entry of history) {
          if (entry.was_winner) {
            newWinStreak++
          } else {
            break // Streak broken
          }
        }
      }

      // Cap win streak at total matches (safety check)
      newWinStreak = Math.min(newWinStreak, newTotalMatches)

      const oldTotalMatches = player.total_matches_played || 0
      const oldWinStreak = player.win_streak || 0

      // Only update if values are different
      if (oldTotalMatches !== newTotalMatches || oldWinStreak !== newWinStreak) {
        const { error: updateError } = await supabase
          .from('players')
          .update({
            total_matches_played: newTotalMatches,
            win_streak: newWinStreak
          })
          .eq('id', player.id)

        if (updateError) {
          console.error(`Error updating player ${player.id}:`, updateError)
          results.push({
            player_id: player.id,
            player_name: player.name,
            old_total_matches: oldTotalMatches,
            new_total_matches: newTotalMatches,
            old_win_streak: oldWinStreak,
            new_win_streak: newWinStreak,
            fixed: false
          })
        } else {
          results.push({
            player_id: player.id,
            player_name: player.name,
            old_total_matches: oldTotalMatches,
            new_total_matches: newTotalMatches,
            old_win_streak: oldWinStreak,
            new_win_streak: newWinStreak,
            fixed: true
          })
        }
      }
    }

    const fixedCount = results.filter(r => r.fixed).length
    const totalChecked = results.length

    return {
      success: true,
      message: `Checked ${totalChecked} players, fixed ${fixedCount} players`,
      total_checked: totalChecked,
      total_fixed: fixedCount,
      results: results.filter(r => r.fixed || r.old_total_matches !== r.new_total_matches || r.old_win_streak !== r.new_win_streak)
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error.data || error
    })
  }
})
