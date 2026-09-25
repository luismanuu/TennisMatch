/**
 * Admin endpoint to fix incorrect win streaks and total_matches_played
 * Recalculates these values from rating_history to ensure accuracy
 */

import { and, desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const db = useDb()

    // Get all players
    const allPlayers = await db
      .select({ id: players.id, name: players.name, total_matches_played: players.total_matches_played, win_streak: players.win_streak })
      .from(players)

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
    for (const player of allPlayers) {
      // Rating history for this player (non-reversed, most recent first)
      let history: Array<{ was_winner: boolean; match_id: string }>
      try {
        history = await db
          .select({ was_winner: rating_history.was_winner, match_id: rating_history.match_id })
          .from(rating_history)
          .where(and(eq(rating_history.player_id, player.id), eq(rating_history.rating_reversed, false)))
          .orderBy(desc(rating_history.created_at))
      } catch (historyError) {
        console.error(`Error fetching history for player ${player.id}:`, historyError)
        continue
      }

      // Total matches = distinct match ids in that history
      const newTotalMatches = new Set(history.map(m => m.match_id)).size

      // Calculate current win streak from history
      let newWinStreak = 0
      if (history.length > 0) {
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
        let fixed = true
        try {
          await db
            .update(players)
            .set({ total_matches_played: newTotalMatches, win_streak: newWinStreak })
            .where(eq(players.id, player.id))
        } catch (updateError) {
          console.error(`Error updating player ${player.id}:`, updateError)
          fixed = false
        }
        results.push({
          player_id: player.id,
          player_name: player.name,
          old_total_matches: oldTotalMatches,
          new_total_matches: newTotalMatches,
          old_win_streak: oldWinStreak,
          new_win_streak: newWinStreak,
          fixed
        })
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
