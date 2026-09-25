import { findFallbackMatches, recalculateMatchRatings } from '~/server/utils/rating-system'
import { requireAdmin } from '~/server/utils/session'
import type { RatingCalculationResult } from '~/types'

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
 * Each match is reprocessed on its own (recalculateMatchRatings): its reversal and recalculation apply together or
 * not at all, and the LLM is asked with no transaction open.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    
    const matchId = query.match_id as string | undefined
    const limit = parseInt(query.limit as string) || 100
    const dryRun = query.dry_run === 'true'

    // Competitive matches rated with the fallback (see fallbackMatchCondition), oldest first
    const fallbackMatches = await findFallbackMatches({ matchId, limit })

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
        const { reversed, result } = await recalculateMatchRatings(match.id)
        if (!result) {
          results.push({
            match_id: match.id,
            status: 'error',
            message: 'Recalculation returned null (check logs for details)'
          })
          continue
        }

        const prefix = reversed > 0 ? 'Successfully reprocessed' : 'Match had no previous calculation'
        results.push({
          match_id: match.id,
          status: 'success',
          message: `${prefix}. ${llmStatus(result)}. Player1: ${signed(result.player1.eloChange)} ELO, Player2: ${signed(result.player2.eloChange)} ELO`,
          llm_used: result.llmUsed || false,
          llm_failed: result.llmFailed || false
        })
      } catch (error: unknown) {
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
