import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches } from '~/server/db/schema'
import { clearLlmCalculation, reverseMatchRatings, updateRatingsAfterMatch } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/session'
import type { RatingCalculationResult } from '~/types'

// Thrown inside a match's transaction so a recalculation that produced nothing also undoes its reversal
class NothingRecalculated extends Error {}

function signed(change: number): string {
  return `${change > 0 ? '+' : ''}${change}`
}

function llmStatus(result: RatingCalculationResult): string {
  return result.llmUsed
    ? 'LLM calculation used'
    : result.llmFailed
      ? 'LLM calculation failed, used fallback'
      : 'Fallback calculation used (no API key or other reason)'
}

/**
 * Admin endpoint to reprocess matches that used fallback calculation
 * This will reverse existing rating_history entries and recalculate with LLM.
 * Each match is reprocessed in its own transaction: its reversal and recalculation apply together or not at all.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    
    const matchId = query.match_id as string | undefined
    const limit = parseInt(query.limit as string) || 100
    const dryRun = query.dry_run === 'true'

    const db = useDb()

    // Fallback matches are:
    // 1. llm_calculation_failed = true (LLM attempted but failed)
    // 2. OR (llm_elo_calculated = false AND llm_calculation_failed = false) (no API key/not attempted)
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
      .orderBy(asc(matches.created_at)) // Process in chronological order
      .limit(matchId ? 1 : limit)

    if (fallbackMatches.length === 0) {
      return {
        success: true,
        message: 'No matches found that used fallback calculation',
        processed: 0,
        results: []
      }
    }

    if (dryRun) {
      return {
        success: true,
        message: `DRY RUN: Would reprocess ${fallbackMatches.length} match(es)`,
        matches: fallbackMatches,
        processed: 0,
        results: []
      }
    }

    const results: Array<{
      match_id: string
      status: 'success' | 'error' | 'skipped'
      message: string
      error?: string
      llm_used?: boolean
      llm_failed?: boolean
    }> = []

    for (const match of fallbackMatches) {
      try {
        const outcome = await db.transaction(async (tx) => {
          const reversed = await reverseMatchRatings(match.id, tx)
          await clearLlmCalculation(match.id, tx)
          const result = await updateRatingsAfterMatch(match.id, tx)
          if (!result) {
            throw new NothingRecalculated()
          }
          return { reversed, result }
        })

        const { reversed, result } = outcome
        const prefix = reversed > 0 ? 'Successfully reprocessed' : 'Match had no previous calculation'
        results.push({
          match_id: match.id,
          status: 'success',
          message: `${prefix}. ${llmStatus(result)}. Player1: ${signed(result.player1.eloChange)} ELO, Player2: ${signed(result.player2.eloChange)} ELO`,
          llm_used: result.llmUsed || false,
          llm_failed: result.llmFailed || false
        })
      } catch (error: unknown) {
        if (error instanceof NothingRecalculated) {
          results.push({
            match_id: match.id,
            status: 'error',
            message: 'Recalculation returned null (check logs for details)'
          })
          continue
        }
        results.push({
          match_id: match.id,
          status: 'error',
          message: 'Failed to reprocess match',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.error(`Error reprocessing match ${match.id}:`, error)
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length
    const skippedCount = results.filter(r => r.status === 'skipped').length

    return {
      success: true,
      message: `Processed ${fallbackMatches.length} match(es): ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`,
      processed: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
      data: error
    })
  }
})
