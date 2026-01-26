/**
 * Script to process matches that are missing rating_history
 * These are matches that were completed and marked as competitive but
 * updateRatingsAfterMatch was never called or failed silently
 * 
 * Usage: npx tsx scripts/process-missing-rating-history.ts [player_id]
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Get player ID from command line args (optional)
const playerId = process.argv[2]

async function processMissingRatingHistory() {
  console.log('🔍 Finding matches missing rating_history...\n')

  // Build query
  let query = supabase
    .from('matches')
    .select('id, status, is_competitive, score, winner_id, player1_id, player2_id, played_at, created_at')
    .eq('status', 'completed')
    .eq('is_competitive', true)
    .not('winner_id', 'is', null)
    .not('player1_id', 'is', null)
    .not('player2_id', 'is', null)

  // Filter by player if provided
  if (playerId) {
    query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
  }

  const { data: matches, error } = await query

  if (error) {
    console.error('Error fetching matches:', error)
    process.exit(1)
  }

  if (!matches || matches.length === 0) {
    console.log('✅ No matches found that need processing')
    return
  }

  // Check which ones don't have rating_history
  const matchesToProcess: typeof matches = []

  for (const match of matches) {
    // Skip self-matches
    if (match.player1_id === match.player2_id) {
      continue
    }

    // Check if rating_history exists
    const { data: history } = await supabase
      .from('rating_history')
      .select('id')
      .eq('match_id', match.id)
      .eq('rating_reversed', false)
      .limit(1)

    if (!history || history.length === 0) {
      matchesToProcess.push(match)
    }
  }

  if (matchesToProcess.length === 0) {
    console.log('✅ All matches already have rating_history')
    return
  }

  console.log(`📊 Found ${matchesToProcess.length} matches that need processing:\n`)

  // Process each match
  const results: Array<{ matchId: string; status: 'success' | 'error'; message: string }> = []

  for (const match of matchesToProcess) {
    console.log(`Processing match ${match.id}...`)
    console.log(`  Score: ${match.score || 'N/A'}`)
    console.log(`  Created: ${match.created_at}`)

    try {
      // Call the calculate-elo endpoint logic directly
      // We need to import and call updateRatingsAfterMatch
      // For now, we'll use a fetch to the API endpoint
      const apiUrl = process.env.API_URL || 'http://localhost:3000'
      const response = await fetch(`${apiUrl}/api/matches/${match.id}/calculate-elo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        console.log(`  ✅ Success: ${result.message}\n`)
        results.push({
          matchId: match.id,
          status: 'success',
          message: result.message
        })
      } else {
        console.log(`  ❌ Failed: ${result.message || 'Unknown error'}\n`)
        results.push({
          matchId: match.id,
          status: 'error',
          message: result.message || 'Unknown error'
        })
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`)
      results.push({
        matchId: match.id,
        status: 'error',
        message: error.message
      })
    }

    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary
  console.log('\n📊 Processing Summary:')
  console.log(`  Total matches: ${matchesToProcess.length}`)
  console.log(`  Successful: ${results.filter(r => r.status === 'success').length}`)
  console.log(`  Failed: ${results.filter(r => r.status === 'error').length}`)

  if (results.some(r => r.status === 'error')) {
    console.log('\n❌ Failed matches:')
    results
      .filter(r => r.status === 'error')
      .forEach(r => console.log(`  - ${r.matchId}: ${r.message}`))
  }
}

processMissingRatingHistory()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
