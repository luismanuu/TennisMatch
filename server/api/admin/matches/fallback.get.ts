import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { logger } from '~/server/utils/logger'
import { adminListPaginationSchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import type { PaginatedResponse } from '~/types'
import { handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event): Promise<PaginatedResponse<unknown>> => {
  try {
    const query = validateQuery(adminListPaginationSchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build query for fallback matches
    // Fallback matches are:
    // 1. llm_calculation_failed = true (LLM attempted but failed)
    // 2. OR (llm_elo_calculated = false AND llm_calculation_failed = false) (no API key/not attempted)
    let queryBuilder = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
          status,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status
        ),
        winner:players!winner_id(
          id,
          name,
          status
        )
      `)
      .or('llm_calculation_failed.eq.true,and(llm_elo_calculated.eq.false,llm_calculation_failed.eq.false)')
      .eq('status', 'completed')
      .not('score', 'is', null)

    // First, get all match IDs that have active rating to exclude them
    // We'll use this to filter both the query and the count
    const { data: allFallbackMatchIds } = await supabase
      .from('matches')
      .select('id')
      .or('llm_calculation_failed.eq.true,and(llm_elo_calculated.eq.false,llm_calculation_failed.eq.false)')
      .eq('status', 'completed')
      .not('score', 'is', null)

    let matchesWithRatingIds: string[] = []
    if (allFallbackMatchIds && allFallbackMatchIds.length > 0) {
      const allMatchIds = (allFallbackMatchIds as unknown as Array<{ id: string }>).map((m) => m.id)
      const { data: ratingHistoryForAll } = await supabase
        .from('rating_history')
        .select('match_id')
        .in('match_id', allMatchIds)
        .eq('rating_reversed', false)
      
      if (ratingHistoryForAll && Array.isArray(ratingHistoryForAll)) {
        matchesWithRatingIds = (ratingHistoryForAll as unknown as Array<{ match_id: string | null }>)
          .map((entry) => entry.match_id)
          .filter((id): id is string => Boolean(id)) // Remove null/undefined
      }
    }

    // Get total count excluding matches with rating
    const totalFallbackMatches = allFallbackMatchIds ? allFallbackMatchIds.length : 0
    const count = totalFallbackMatches - matchesWithRatingIds.length

    // Apply pagination and ordering
    // Note: We'll filter out matches with rating after fetching
    // Fetch a bit more to account for filtered matches
    const fetchLimit = matchesWithRatingIds.length > 0 ? Math.min(limit * 3, 500) : limit
    const { data: matches, error: fetchError } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(0, fetchLimit - 1)

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch fallback matches',
        data: fetchError
      })
    }

    if (!matches || matches.length === 0) {
      return {
        data: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit
      }
    }

    // Filter out matches that already have active rating
    const matchesWithRatingSet = new Set(matchesWithRatingIds)
    const matchesWithoutRating = (matches as unknown as Array<{ id: string }>).filter((match) => !matchesWithRatingSet.has(match.id))
    
    // Apply pagination after filtering
    const paginatedMatches = matchesWithoutRating.slice(offset, offset + limit)

    // Get rating history for remaining matches to check reprocessed status
    const matchIds = paginatedMatches.map((m) => m.id)
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select('match_id, rating_reversed')
      .in('match_id', matchIds)
      .eq('rating_reversed', true) // Only get reprocessed ones

    if (historyError) {
      logger.error('Error fetching rating history for reprocessed status', historyError)
    }

    // Create set of match IDs that have been reprocessed
    const reprocessedMatchIds = new Set<string>()
    if (ratingHistory && Array.isArray(ratingHistory)) {
      ;(ratingHistory as unknown as Array<{ match_id: string | null }>).forEach((entry) => {
        if (entry.match_id) reprocessedMatchIds.add(entry.match_id)
      })
    }

    // Enrich matches with reprocessed status and fallback reason
    const enrichedMatches = (paginatedMatches as unknown as Array<Record<string, unknown> & { id: string }>).map((match) => {
      const isReprocessed = reprocessedMatchIds.has(match.id)
      
      // Determine fallback reason
      let fallbackReason = (typeof match['llm_calculation_reasoning'] === 'string' ? (match['llm_calculation_reasoning'] as string) : null) || null
      
      // If no reasoning stored, determine based on match state
      if (!fallbackReason) {
        if (match['llm_calculation_failed'] === true) {
          fallbackReason = 'LLM calculation failed (error details not available)'
        } else if (match['llm_elo_calculated'] === false && match['llm_calculation_failed'] === false) {
          // Check if it's a walkover
          const score = typeof match['score'] === 'string' ? (match['score'] as string) : null
          const isWalkover = score?.trim().toUpperCase() === 'WO'
          if (isWalkover) {
            fallbackReason = 'Walkover (WO) match - using standard ELO calculation (no LLM needed)'
          } else if (!score) {
            fallbackReason = 'Match score not available. LLM calculation requires a score to analyze.'
          } else {
            fallbackReason = 'LLM calculation was not attempted - likely no API key configured (check OPENROUTER_API_KEY environment variable)'
          }
        } else if (match['llm_elo_calculated'] === true) {
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
      total: count,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/matches/fallback')
  }
})
