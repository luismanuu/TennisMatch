/**
 * Script to process matches that are missing rating_history
 * These are matches that were completed and marked as competitive but
 * updateRatingsAfterMatch was never called or failed
 *
 * Usage: DATABASE_URL=... npx tsx scripts/process-missing-rating-history.ts [player_id]
 * (DATABASE_URL may also come from .env.local or .env)
 */

import { resolve } from 'node:path'
import { config } from 'dotenv'
import { findMatchesMissingRatingHistory, updateRatingsAfterMatch } from '../server/utils/rating-system'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

// Get player ID from command line args (optional)
const playerId = process.argv[2]

async function processMissingRatingHistory() {
  console.log('Finding matches missing rating_history...\n')

  const matchesToProcess = await findMatchesMissingRatingHistory({ playerId })

  if (matchesToProcess.length === 0) {
    console.log('No matches found that need processing')
    return
  }

  console.log(`Found ${matchesToProcess.length} matches that need processing:\n`)

  const results: Array<{ matchId: string; status: 'success' | 'error'; message: string }> = []

  // Oldest first, one transaction per match
  for (const match of matchesToProcess) {
    console.log(`Processing match ${match.id}...`)
    console.log(`  Score: ${match.score || 'N/A'}`)
    console.log(`  Created: ${match.created_at?.toISOString() ?? 'N/A'}`)

    try {
      const result = await updateRatingsAfterMatch(match.id)
      if (result) {
        const message = `Player1: ${result.player1.eloChange > 0 ? '+' : ''}${result.player1.eloChange} ELO, Player2: ${result.player2.eloChange > 0 ? '+' : ''}${result.player2.eloChange} ELO`
        console.log(`  Success: ${message}\n`)
        results.push({ matchId: match.id, status: 'success', message })
      } else {
        const message = 'updateRatingsAfterMatch returned null (match cannot be rated or was already rated)'
        console.log(`  Failed: ${message}\n`)
        results.push({ matchId: match.id, status: 'error', message })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  Error: ${message}\n`)
      results.push({ matchId: match.id, status: 'error', message })
    }
  }

  console.log('\nProcessing Summary:')
  console.log(`  Total matches: ${matchesToProcess.length}`)
  console.log(`  Successful: ${results.filter(r => r.status === 'success').length}`)
  console.log(`  Failed: ${results.filter(r => r.status === 'error').length}`)

  if (results.some(r => r.status === 'error')) {
    console.log('\nFailed matches:')
    results
      .filter(r => r.status === 'error')
      .forEach(r => console.log(`  - ${r.matchId}: ${r.message}`))
  }
}

processMissingRatingHistory()
  .then(() => {
    console.log('\nScript completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
