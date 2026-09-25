import { and, count, desc, eq, exists, inArray, isNotNull, not, or } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, rating_history } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const categoryColumns = { columns: { id: true, name: true, description: true, order: true } } as const
const listedPlayer = { columns: { id: true, name: true, status: true }, with: { category: categoryColumns } } as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()

    // Fallback matches are completed, scored matches where:
    // 1. llm_calculation_failed = true (LLM attempted but failed)
    // 2. OR (llm_elo_calculated = false AND llm_calculation_failed = false) (no API key/not attempted)
    // Matches that already have an active (non-reversed) rating are left out.
    const where = and(
      or(
        eq(matches.llm_calculation_failed, true),
        and(eq(matches.llm_elo_calculated, false), eq(matches.llm_calculation_failed, false))
      ),
      eq(matches.status, 'completed'),
      isNotNull(matches.score),
      not(
        exists(
          db
            .select({ id: rating_history.id })
            .from(rating_history)
            .where(and(eq(rating_history.match_id, matches.id), eq(rating_history.rating_reversed, false)))
        )
      )
    )

    const [{ total }] = await db.select({ total: count() }).from(matches).where(where)

    const paginatedMatches = await db.query.matches.findMany({
      where,
      with: {
        player1: listedPlayer,
        player2: listedPlayer,
        pending_player2: {
          columns: { id: true, name: true, email: true, status: true },
          with: { category: categoryColumns },
        },
        winner: { columns: { id: true, name: true, status: true } },
      },
      orderBy: [desc(matches.created_at)],
      limit,
      offset,
    })

    // Matches with reversed rating history have been reprocessed before
    const matchIds = paginatedMatches.map((m) => m.id)
    const reprocessed = matchIds.length > 0
      ? await db
          .selectDistinct({ match_id: rating_history.match_id })
          .from(rating_history)
          .where(and(inArray(rating_history.match_id, matchIds), eq(rating_history.rating_reversed, true)))
      : []
    const reprocessedMatchIds = new Set(reprocessed.map((r) => r.match_id))

    // Enrich matches with reprocessed status and fallback reason
    const enrichedMatches = paginatedMatches.map((match) => {
      const isReprocessed = reprocessedMatchIds.has(match.id)
      
      // Determine fallback reason
      let fallbackReason = match.llm_calculation_reasoning || null
      
      // If no reasoning stored, determine based on match state
      if (!fallbackReason) {
        if (match.llm_calculation_failed === true) {
          fallbackReason = 'LLM calculation failed (error details not available)'
        } else if (match.llm_elo_calculated === false && match.llm_calculation_failed === false) {
          // Check if it's a walkover
          const isWalkover = match.score?.trim().toUpperCase() === 'WO'
          if (isWalkover) {
            fallbackReason = 'Walkover (WO) match - using standard ELO calculation (no LLM needed)'
          } else if (!match.score) {
            fallbackReason = 'Match score not available. LLM calculation requires a score to analyze.'
          } else {
            fallbackReason = 'LLM calculation was not attempted - likely no API key configured (check OPENROUTER_API_KEY environment variable)'
          }
        } else if (match.llm_elo_calculated === true) {
          fallbackReason = 'LLM calculation succeeded (this should not appear in fallback list)'
        } else {
          fallbackReason = 'Unknown reason - match may not have been processed yet'
        }
      }

      return {
        ...match,
        is_reprocessed: isReprocessed,
        fallback_reason: fallbackReason
      }
    })

    return {
      data: enrichedMatches,
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
