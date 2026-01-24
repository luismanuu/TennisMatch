/**
 * Script to fix incorrect win streaks and total_matches_played
 * Recalculates these values from rating_history to ensure accuracy
 * 
 * Usage: npx tsx scripts/fix-win-streaks.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Load environment variables (try multiple possible names)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  console.error('Current env vars:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
  })
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixWinStreaks() {
  console.log('Starting win streak fix...\n')

  // Get all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, total_matches_played, win_streak')

  if (playersError) {
    console.error('Error fetching players:', playersError)
    process.exit(1)
  }

  console.log(`Found ${players?.length || 0} players to check\n`)

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
        console.log(`✓ Fixed ${player.name}: matches ${oldTotalMatches}→${newTotalMatches}, streak ${oldWinStreak}→${newWinStreak}`)
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
  const needsFix = results.filter(r => r.old_total_matches !== r.new_total_matches || r.old_win_streak !== r.new_win_streak)

  console.log(`\n=== Summary ===`)
  console.log(`Total players checked: ${players?.length || 0}`)
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

fixWinStreaks().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
