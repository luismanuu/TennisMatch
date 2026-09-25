/**
 * Script to fix incorrect win streaks and total_matches_played
 * Recalculates these values from rating_history to ensure accuracy
 * 
 * Usage: DATABASE_URL=... npx tsx scripts/fix-win-streaks.ts
 */

import { resolve } from 'node:path'
import { config } from 'dotenv'
import { and, desc, eq } from 'drizzle-orm'
import { useDb } from '../server/db'
import { players, rating_history } from '../server/db/schema'

// Load environment variables from .env files
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL must be set')
  process.exit(1)
}

async function fixWinStreaks() {
  console.log('Starting win streak fix...\n')

  const db = useDb()

  // Get all players
  const allPlayers = await db
    .select({ id: players.id, name: players.name, total_matches_played: players.total_matches_played, win_streak: players.win_streak })
    .from(players)

  console.log(`Found ${allPlayers.length} players to check\n`)

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
    const history = await db
      .select({ was_winner: rating_history.was_winner, match_id: rating_history.match_id })
      .from(rating_history)
      .where(and(eq(rating_history.player_id, player.id), eq(rating_history.rating_reversed, false)))
      .orderBy(desc(rating_history.created_at))

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
        console.log(`Fixed ${player.name}: matches ${oldTotalMatches}→${newTotalMatches}, streak ${oldWinStreak}→${newWinStreak}`)
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
  const needsFix = results.filter(r => r.old_total_matches !== r.new_total_matches || r.old_win_streak !== r.new_win_streak)

  console.log(`\n=== Summary ===`)
  console.log(`Total players checked: ${allPlayers.length}`)
  console.log(`Players needing fix: ${needsFix.length}`)
  console.log(`Players fixed: ${fixedCount}`)

  if (needsFix.length > 0) {
    console.log(`\n=== Players Fixed ===`)
    needsFix.forEach(r => {
      console.log(`${r.player_name}: matches ${r.old_total_matches}→${r.new_total_matches}, streak ${r.old_win_streak}→${r.new_win_streak} ${r.fixed ? '✓' : '✗'}`)
    })
  }

  console.log('\nDone!')
}

fixWinStreaks().then(() => process.exit(0)).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
