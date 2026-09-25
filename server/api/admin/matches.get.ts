import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

// Ecuador timezone offset: UTC-5
const ECUADOR_UTC_OFFSET = -5

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const status = query.status as string | undefined
    const playerId = query.player_id as string | undefined
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

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
          // Convert start of day in Ecuador (00:00:00) to UTC
          // Ecuador is UTC-5, so 00:00:00 on day X in Ecuador = 05:00:00 on day X-1 in UTC
          // Example: 2026-01-22 00:00:00 Ecuador = 2026-01-21 05:00:00 UTC
          const [year, month, day] = startDate.split('-').map(Number)
          // Create UTC date: day X at 05:00 UTC = day X at 00:00 Ecuador
          // We need day X-1 at 05:00 UTC
          const utcDate = new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0, 0))
          startDateValue = utcDate.toISOString()
        }
      }
      
      if (endDate) {
        // If endDate is just a date (YYYY-MM-DD), include the entire day in Ecuador timezone
        endDateValue = endDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          // Convert end of day in Ecuador (23:59:59.999) to UTC
          // Ecuador is UTC-5, so 23:59:59.999 on day X in Ecuador = 04:59:59.999 on day X+1 in UTC
          // To include the entire day, we use 05:00:00 on day X+1 in UTC
          // Example: 2026-01-22 23:59:59.999 Ecuador = 2026-01-23 04:59:59.999 UTC
          // We use 2026-01-23 05:00:00 UTC to include everything
          const [year, month, day] = endDate.split('-').map(Number)
          // Create UTC date: day X+1 at 05:00 UTC = day X+1 at 00:00 Ecuador (includes all of day X)
          const utcDate = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0))
          endDateValue = utcDate.toISOString()
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
          const [year, month, day] = startDate.split('-').map(Number)
          const utcDate = new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0, 0))
          startDateValue = utcDate.toISOString()
        }
      }
      
      if (endDate) {
        endDateValue = endDate
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const [year, month, day] = endDate.split('-').map(Number)
          const utcDate = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0))
          endDateValue = utcDate.toISOString()
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
      matches.forEach((match: any) => {
        if (match && typeof match === 'object') {
          if (match.score_proposed_by && typeof match.score_proposed_by === 'string') {
            allPlayerIds.add(match.score_proposed_by)
          }
          if (match.score_approved_by && typeof match.score_approved_by === 'string') {
            allPlayerIds.add(match.score_approved_by)
          }
          if (match.reschedule_proposed_by && typeof match.reschedule_proposed_by === 'string') {
            allPlayerIds.add(match.reschedule_proposed_by)
          }
          if (match.reschedule_approved_by && typeof match.reschedule_approved_by === 'string') {
            allPlayerIds.add(match.reschedule_approved_by)
          }
          if (match.reschedule_rejected_by && typeof match.reschedule_rejected_by === 'string') {
            allPlayerIds.add(match.reschedule_rejected_by)
          }
        }
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
          playerMap = new Map(players.map((p: any) => [p.id, p]))
        }
      }
    }

    // Enrich matches with optional player relationships using the batched data
    const enrichedMatches = Array.isArray(matches) 
      ? matches.map((match: any) => {
          if (!match || typeof match !== 'object') {
            return match
          }
          
          const enriched: any = { ...match }
          
          // Only add these fields if they exist in the original match
          if (match.score_proposed_by) {
            enriched.score_proposed_by_player = playerMap.get(match.score_proposed_by) || null
          }
          if (match.score_approved_by) {
            enriched.score_approved_by_player = playerMap.get(match.score_approved_by) || null
          }
          if (match.reschedule_proposed_by) {
            enriched.reschedule_proposed_by_player = playerMap.get(match.reschedule_proposed_by) || null
          }
          if (match.reschedule_approved_by) {
            enriched.reschedule_approved_by_player = playerMap.get(match.reschedule_approved_by) || null
          }
          if (match.reschedule_rejected_by) {
            enriched.reschedule_rejected_by_player = playerMap.get(match.reschedule_rejected_by) || null
          }
          
          return enriched
        })
      : []

    return {
      data: enrichedMatches,
      total: count || 0,
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

