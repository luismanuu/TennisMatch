/**
 * Script to reprocess matches that used fallback calculation
 * Reverses each match's rating_history and recalculates it (with the LLM when OPENROUTER_API_KEY is set).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/reprocess-fallback-matches.ts [options]
 *   (DATABASE_URL and OPENROUTER_API_KEY may also come from .env.local or .env)
 *
 * Options:
 *   --match-id <id>     Process a specific match
 *   --limit <number>    Maximum matches to process (default: 100)
 *   --dry-run           Preview without making changes
 */

import { resolve } from 'node:path'
import { config } from 'dotenv'
import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { useDb } from '../server/db'
import { matches } from '../server/db/schema'
import { clearLlmCalculation, reverseMatchRatings, updateRatingsAfterMatch } from '../server/utils/rating-system'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const args = process.argv.slice(2)
let matchId: string | undefined
let limit = 100
let dryRun = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--match-id' && args[i + 1]) {
    matchId = args[i + 1]
    i++
  } else if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1]) || 100
    i++
  } else if (args[i] === '--dry-run') {
    dryRun = true
  }
}

async function reprocessMatches() {
  console.log('Reprocessing fallback matches...')
  if (matchId) console.log(`   Match ID: ${matchId}`)
  console.log(`   Limit: ${limit}`)
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`)

  const db = useDb()

  // Fallback: LLM failed, or LLM not attempted (no API key); completed with a score; oldest first
  const fallbackMatches = await db
    .select({ id: matches.id, played_at: matches.played_at, score: matches.score })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'completed'),
        or(
          eq(matches.llm_calculation_failed, true),
          and(eq(matches.llm_elo_calculated, false), eq(matches.llm_calculation_failed, false))
        ),
        isNotNull(matches.score),
        matchId ? eq(matches.id, matchId) : undefined
      )
    )
    .orderBy(asc(matches.created_at))
    .limit(matchId ? 1 : limit)

  if (fallbackMatches.length === 0) {
    console.log('No matches found that used fallback calculation')
    return
  }

  if (dryRun) {
    console.log(`DRY RUN: Would reprocess ${fallbackMatches.length} match(es)`)
    for (const m of fallbackMatches) {
      console.log(`   ${m.id}  played ${m.played_at?.toISOString() ?? 'N/A'}  score ${m.score}`)
    }
    return
  }

  let succeeded = 0
  let failed = 0
  for (const match of fallbackMatches) {
    try {
      // Reversal and recalculation apply together or not at all
      const result = await db.transaction(async (tx) => {
        await reverseMatchRatings(match.id, tx)
        await clearLlmCalculation(match.id, tx)
        const rated = await updateRatingsAfterMatch(match.id, tx)
        if (!rated) {
          throw new Error('Recalculation returned null; nothing was changed')
        }
        return rated
      })
      succeeded++
      console.log(`   OK   ${match.id}: Player1 ${result.player1.eloChange}, Player2 ${result.player2.eloChange}${result.llmUsed ? ' (LLM)' : ''}`)
    } catch (error: unknown) {
      failed++
      console.error(`   FAIL ${match.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\nProcessed ${fallbackMatches.length} match(es): ${succeeded} successful, ${failed} errors`)
}

reprocessMatches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error instanceof Error ? error.stack ?? error.message : error)
    process.exit(1)
  })
