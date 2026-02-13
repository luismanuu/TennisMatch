import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminMatchesListQuerySchema, validateQuery } from '~/server/utils/validation'
import type { PaginatedResponse } from '~/types'
import { handleApiError } from '~/server/utils/errors'

// Ecuador timezone offset: UTC-5
const ECUADOR_UTC_OFFSET = -5

export default defineEventHandler(async (event): Promise<PaginatedResponse<unknown>> => {
  try {
    const query = validateQuery(adminMatchesListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const status = query.status
    const playerId = query.player_id
    const startDate = query.start_date
    const endDate = query.end_date
    
    // Pagination parameters
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Build query
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

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (playerId) {
      queryBuilder = queryBuilder.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    }

    // Handle date filters - for scheduled matches, include those without scheduled_at (NULL)
    if (startDate || endDate) {
      let startDateValue: string | undefined
      let endDateValue: string | undefined
      
      if (startDate) {
        // If startDate is just a date (YYYY-MM-DD), ensure it starts at 00:00:00 in Ecuador timezone
        startDateValue = startDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const [yearStr, monthStr, dayStr] = startDate.split('-')
          const year = Number(yearStr)
          const month = Number(monthStr)
          const day = Number(dayStr)
          if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            // Convert start of day in Ecuador (00:00:00) to UTC
            // Ecuador is UTC-5, so 00:00:00 on day X in Ecuador = 05:00:00 on day X-1 in UTC
            const utcDate = new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0, 0))
            startDateValue = utcDate.toISOString()
          }
        }
      }
      
      if (endDate) {
        // If endDate is just a date (YYYY-MM-DD), include the entire day in Ecuador timezone
        endDateValue = endDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const [yearStr, monthStr, dayStr] = endDate.split('-')
          const year = Number(yearStr)
          const month = Number(monthStr)
          const day = Number(dayStr)
          if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            // Convert end of day in Ecuador to UTC (see comment above)
            const utcDate = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0))
            endDateValue = utcDate.toISOString()
          }
        }
      }
      
      // For scheduled matches, also include matches without scheduled_at (NULL)
      // This ensures that "scheduled" matches without a date are still shown when filtering
      if (status === 'scheduled') {
        // For scheduled matches, we want to include:
        // 1. Matches with scheduled_at in the date range (if dates are provided)
        // 2. Matches without scheduled_at (NULL) - always include these
        // We use a PostgREST OR syntax to combine conditions
        if (startDateValue && endDateValue) {
          // Both dates: include matches in range OR matches without scheduled_at
          // PostgREST syntax: or=(condition1,condition2)
          queryBuilder = queryBuilder.or(`and(scheduled_at.gte.${startDateValue},scheduled_at.lte.${endDateValue}),scheduled_at.is.null`)
        } else if (startDateValue) {
          // Only start date: scheduled_at >= start OR scheduled_at IS NULL
          queryBuilder = queryBuilder.or(`scheduled_at.gte.${startDateValue},scheduled_at.is.null`)
        } else if (endDateValue) {
          // Only end date: scheduled_at <= end OR scheduled_at IS NULL
          queryBuilder = queryBuilder.or(`scheduled_at.lte.${endDateValue},scheduled_at.is.null`)
        }
      } else {
        // For other statuses, apply date filters normally
        if (startDateValue) {
          queryBuilder = queryBuilder.gte('scheduled_at', startDateValue)
        }
        if (endDateValue) {
          queryBuilder = queryBuilder.lte('scheduled_at', endDateValue)
        }
      }
    }

    // Get total count - apply same date filter logic as main query
    let countQuery = supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
    
    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    if (playerId) {
      countQuery = countQuery.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    }
    
    // Apply same date filter logic as main query
    if (startDate || endDate) {
      let startDateValue: string | undefined
      let endDateValue: string | undefined
      
      if (startDate) {
        startDateValue = startDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const [yearStr, monthStr, dayStr] = startDate.split('-')
          const year = Number(yearStr)
          const month = Number(monthStr)
          const day = Number(dayStr)
          if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            const utcDate = new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0, 0))
            startDateValue = utcDate.toISOString()
          }
        }
      }
      
      if (endDate) {
        endDateValue = endDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const [yearStr, monthStr, dayStr] = endDate.split('-')
          const year = Number(yearStr)
          const month = Number(monthStr)
          const day = Number(dayStr)
          if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            const utcDate = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0))
            endDateValue = utcDate.toISOString()
          }
        }
      }
      
      // For scheduled matches, also include matches without scheduled_at (NULL)
      if (status === 'scheduled') {
        if (startDateValue && endDateValue) {
          countQuery = countQuery.or(`and(scheduled_at.gte.${startDateValue},scheduled_at.lte.${endDateValue}),scheduled_at.is.null`)
        } else if (startDateValue) {
          countQuery = countQuery.or(`scheduled_at.gte.${startDateValue},scheduled_at.is.null`)
        } else if (endDateValue) {
          countQuery = countQuery.or(`scheduled_at.lte.${endDateValue},scheduled_at.is.null`)
        }
      } else {
        if (startDateValue) {
          countQuery = countQuery.gte('scheduled_at', startDateValue)
        }
        if (endDateValue) {
          countQuery = countQuery.lte('scheduled_at', endDateValue)
        }
      }
    }
    
    const { count, error: countError } = await countQuery
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count matches',
        data: countError
      })
    }

    // Apply pagination and ordering
    // Order by scheduled_at descending (nulls last), then by created_at descending for matches without scheduled_at
    const { data: matches, error: fetchError } = await queryBuilder
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches',
        data: fetchError
      })
    }

    // Collect all player IDs from optional relationships for batch lookup
    // Only if matches exist and have these fields
    const allPlayerIds = new Set<string>()
    if (matches && Array.isArray(matches)) {
      matches.forEach((match) => {
        const m = match as Record<string, unknown> | null
        if (!m) return

        const scoreProposedBy = typeof m['score_proposed_by'] === 'string' ? (m['score_proposed_by'] as string) : null
        const scoreApprovedBy = typeof m['score_approved_by'] === 'string' ? (m['score_approved_by'] as string) : null
        const rescheduleProposedBy =
          typeof m['reschedule_proposed_by'] === 'string' ? (m['reschedule_proposed_by'] as string) : null
        const rescheduleApprovedBy =
          typeof m['reschedule_approved_by'] === 'string' ? (m['reschedule_approved_by'] as string) : null
        const rescheduleRejectedBy =
          typeof m['reschedule_rejected_by'] === 'string' ? (m['reschedule_rejected_by'] as string) : null

        if (scoreProposedBy) allPlayerIds.add(scoreProposedBy)
        if (scoreApprovedBy) allPlayerIds.add(scoreApprovedBy)
        if (rescheduleProposedBy) allPlayerIds.add(rescheduleProposedBy)
        if (rescheduleApprovedBy) allPlayerIds.add(rescheduleApprovedBy)
        if (rescheduleRejectedBy) allPlayerIds.add(rescheduleRejectedBy)
      })
    }

    // Batch fetch all optional player relationships in a single query
    let playerMap = new Map<string, { id: string; name: string }>()
    if (allPlayerIds.size > 0) {
      const playerIdsArray = Array.from(allPlayerIds)
      if (playerIdsArray.length > 0) {
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIdsArray)
        
        if (!playersError && players && Array.isArray(players)) {
          const typedPlayers = players as unknown as Array<{ id: string; name: string }>
          playerMap = new Map(typedPlayers.map((p) => [p.id, p]))
        }
      }
    }

    // Enrich matches with optional player relationships using the batched data
    const enrichedMatches = Array.isArray(matches) 
      ? matches.map((match) => {
          if (!match || typeof match !== 'object') return match
          const m = match as Record<string, unknown>

          const scoreProposedBy = typeof m['score_proposed_by'] === 'string' ? (m['score_proposed_by'] as string) : null
          const scoreApprovedBy = typeof m['score_approved_by'] === 'string' ? (m['score_approved_by'] as string) : null
          const rescheduleProposedBy =
            typeof m['reschedule_proposed_by'] === 'string' ? (m['reschedule_proposed_by'] as string) : null
          const rescheduleApprovedBy =
            typeof m['reschedule_approved_by'] === 'string' ? (m['reschedule_approved_by'] as string) : null
          const rescheduleRejectedBy =
            typeof m['reschedule_rejected_by'] === 'string' ? (m['reschedule_rejected_by'] as string) : null

          const enriched: Record<string, unknown> = { ...m }
          if (scoreProposedBy) enriched['score_proposed_by_player'] = playerMap.get(scoreProposedBy) ?? null
          if (scoreApprovedBy) enriched['score_approved_by_player'] = playerMap.get(scoreApprovedBy) ?? null
          if (rescheduleProposedBy) enriched['reschedule_proposed_by_player'] = playerMap.get(rescheduleProposedBy) ?? null
          if (rescheduleApprovedBy) enriched['reschedule_approved_by_player'] = playerMap.get(rescheduleApprovedBy) ?? null
          if (rescheduleRejectedBy) enriched['reschedule_rejected_by_player'] = playerMap.get(rescheduleRejectedBy) ?? null
          return enriched
        })
      : []

    return {
      data: enrichedMatches,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/matches')
  }
})

