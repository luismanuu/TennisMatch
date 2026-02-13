import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'
import { getClerkUser } from '~/server/utils/clerk'
import { matchesListQuerySchema, validateQuery } from '~/server/utils/validation'
import type { MatchRow } from '~/server/services/matches/apply-match-action'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(matchesListQuerySchema, getQuery(event))
    const clerk_id = query.clerk_id
    const page = query.page ?? 1
    const limit = query.limit ?? 10
    const offset = (page - 1) * limit
    const status = query.status
    // Default: show matches from last 24 hours if no date filters are set
    const startDate = query.start_date
    const endDate = query.end_date
    const skip24hFilter = query.skip_24h_filter ?? false
    const opponentId = query.opponent_id
    
    // Verify Clerk user exists
    await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Get current player
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()
    
    if (playerError || !currentPlayer) {
      // If player doesn't exist, return empty array (user hasn't created profile yet)
      return {
        matches: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false
        }
      }
    }
    
    // Build query for matches where user is player1, player2, or invited a pending_player2
    let matchesQuery = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          elo,
          total_matches_played,
          placement_matches_completed,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
          elo,
          total_matches_played,
          placement_matches_completed,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players!pending_player2_id(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status,
          invited_by_player_id
        ),
        winner:players!winner_id(
          id,
          name,
          status
        ),
        tournament:tournaments(
          id,
          name,
          category_id
        ),
        tournament_match:tournament_matches(
          id,
          bracket_type,
          round_number,
          group_id,
          round_deadline,
          group:tournament_groups(
            id,
            group_name
          )
        )
      `, { count: 'exact' })
    
    // Apply opponent filter if provided
    // Filter matches where current player is one player and opponent is the other
    if (opponentId) {
      // Head-to-head filter (single query)
      matchesQuery = matchesQuery.or(
        `and(player1_id.eq.${currentPlayer.id},player2_id.eq.${opponentId}),and(player1_id.eq.${opponentId},player2_id.eq.${currentPlayer.id})`
      )
    } else {
      // No opponent filter: show matches where user is player1 or player2,
      // OR where they invited the pending opponent.
      matchesQuery = matchesQuery.or(
        `player1_id.eq.${currentPlayer.id},player2_id.eq.${currentPlayer.id},pending_player2.invited_by_player_id.eq.${currentPlayer.id}`
      )
    }
    
    // Apply status filter if provided
    if (status) {
      matchesQuery = matchesQuery.eq('status', status)
    } else {
      // Default: exclude cancelled matches unless explicitly requested
      matchesQuery = matchesQuery.neq('status', 'cancelled')
    }
    
    // Apply date filters if provided
    // Include matches with scheduled_at in range OR matches without scheduled_at (for pending proposals)
    if (startDate || endDate) {
      let dateFilter = ''
      if (startDate && endDate) {
        dateFilter = `scheduled_at.gte.${startDate},scheduled_at.lte.${endDate},scheduled_at.is.null`
      } else if (startDate) {
        dateFilter = `scheduled_at.gte.${startDate},scheduled_at.is.null`
      } else if (endDate) {
        dateFilter = `scheduled_at.lte.${endDate},scheduled_at.is.null`
      }
      if (dateFilter) {
        matchesQuery = matchesQuery.or(dateFilter)
      }
    } else if (!status && !skip24hFilter) {
      // Default: show matches from last 24 hours ONLY when no status filter is set (Todos)
      // But also include matches without scheduled_at (pending proposals)
      // Skip this filter if skip_24h_filter is true (e.g., when filtering for pending actions)
      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      // Include matches with scheduled_at >= 24 hours ago OR matches without scheduled_at
      matchesQuery = matchesQuery.or(`scheduled_at.gte.${twentyFourHoursAgo.toISOString()},scheduled_at.is.null`)
    }
    
    const {
      data: allMatches,
      error: matchesError,
      count: totalCount,
    } = await matchesQuery
      // Completed matches should order by played_at first
      .order('played_at', { ascending: false, nullsFirst: false })
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (matchesError) {
      logger.error('Error fetching matches', matchesError, {
        details: matchesError.details,
        hint: matchesError.hint,
        code: matchesError.code,
        fullError: JSON.stringify(matchesError, null, 2)
      })
      
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch matches: ${matchesError.message || 'Unknown error'}`,
        data: {
          error: matchesError.message,
          details: matchesError.details,
          hint: matchesError.hint,
          code: matchesError.code
        }
      })
    }
    
    type MatchListRow = MatchRow &
      Record<string, unknown> & {
        status?: string | null
        played_at?: string | null
        scheduled_at?: string | null
        created_at?: string | null
        tournament_match?: unknown
      }

    let filteredData: MatchListRow[] = ((allMatches || []) as unknown[]).map((match) => {
      const r = match && typeof match === 'object' ? (match as Record<string, unknown>) : {}
      return { ...r } as MatchListRow
    })
    
    // Sort by scheduled_at descending BEFORE enriching (to maintain order)
    // This ensures proper ordering even after merging results from different queries
    // For completed matches, use played_at if available, otherwise scheduled_at
    filteredData.sort((a, b) => {
      // Get the appropriate date for sorting
      const getSortDate = (match: MatchListRow) => {
        // For completed matches, prefer played_at if available, otherwise scheduled_at
        if (match.status === 'completed' && match.played_at) {
          return match.played_at
        }
        return match.scheduled_at
      }
      
      const dateAStr = getSortDate(a)
      const dateBStr = getSortDate(b)
      
      // Only compare if both have dates
      if (!dateAStr && !dateBStr) return 0
      if (!dateAStr) return 1 // Put matches without date at the end
      if (!dateBStr) return -1 // Put matches without date at the end
      
      // Parse dates and handle invalid dates
      const dateA = dateAStr ? new Date(dateAStr).getTime() : 0
      const dateB = dateBStr ? new Date(dateBStr).getTime() : 0
      
      // Handle invalid dates
      if (isNaN(dateA) && isNaN(dateB)) return 0
      if (isNaN(dateA)) return 1
      if (isNaN(dateB)) return -1
      
      // Descending order (newest first) - most recent date first
      return dateB - dateA
    })
    
    // Collect all player IDs from optional relationships for batch lookup
    const allPlayerIds = new Set<string>()
    filteredData.forEach((match) => {
      const row = match as unknown as MatchRow
      if (typeof row.match_proposed_by === 'string' && row.match_proposed_by) allPlayerIds.add(row.match_proposed_by)
      if (typeof row.match_accepted_by === 'string' && row.match_accepted_by) allPlayerIds.add(row.match_accepted_by)
      if (typeof row.match_rejected_by === 'string' && row.match_rejected_by) allPlayerIds.add(row.match_rejected_by)
      if (typeof row.acceptance_change_approved_by === 'string' && row.acceptance_change_approved_by) allPlayerIds.add(row.acceptance_change_approved_by)
      if (typeof row.acceptance_change_rejected_by === 'string' && row.acceptance_change_rejected_by) allPlayerIds.add(row.acceptance_change_rejected_by)
      if (typeof row.score_proposed_by === 'string' && row.score_proposed_by) allPlayerIds.add(row.score_proposed_by)
      if (typeof row.score_approved_by === 'string' && row.score_approved_by) allPlayerIds.add(row.score_approved_by)
      if (typeof row.reschedule_proposed_by === 'string' && row.reschedule_proposed_by) allPlayerIds.add(row.reschedule_proposed_by)
      if (typeof row.reschedule_approved_by === 'string' && row.reschedule_approved_by) allPlayerIds.add(row.reschedule_approved_by)
      if (typeof row.reschedule_rejected_by === 'string' && row.reschedule_rejected_by) allPlayerIds.add(row.reschedule_rejected_by)
    })
    
    // Batch fetch all optional player relationships in a single query
    let playerMap = new Map<string, { id: string; name: string | null }>()
    if (allPlayerIds.size > 0) {
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', Array.from(allPlayerIds))
      
      if (!playersError && players) {
        const typedPlayers = players as unknown as Array<{ id: string; name: string | null }>
        playerMap = new Map(typedPlayers.map((p) => [p.id, p]))
      }
    }
    
    // Enrich matches with optional player relationships using the batched data
    filteredData = filteredData.map((match) => {
      const row = match as unknown as MatchRow
      const enriched: Record<string, unknown> = { ...match }
      
      enriched.match_proposed_by_player = row.match_proposed_by
        ? playerMap.get(row.match_proposed_by) || null 
        : null
      enriched.match_accepted_by_player = row.match_accepted_by
        ? playerMap.get(row.match_accepted_by) || null 
        : null
      enriched.match_rejected_by_player = row.match_rejected_by
        ? playerMap.get(row.match_rejected_by) || null 
        : null
      enriched.acceptance_change_approved_by_player = row.acceptance_change_approved_by
        ? playerMap.get(row.acceptance_change_approved_by) || null 
        : null
      enriched.acceptance_change_rejected_by_player = row.acceptance_change_rejected_by
        ? playerMap.get(row.acceptance_change_rejected_by) || null 
        : null
      enriched.score_proposed_by_player = row.score_proposed_by
        ? playerMap.get(row.score_proposed_by) || null 
        : null
      enriched.score_approved_by_player = row.score_approved_by
        ? playerMap.get(row.score_approved_by) || null 
        : null
      enriched.reschedule_proposed_by_player = row.reschedule_proposed_by
        ? playerMap.get(row.reschedule_proposed_by) || null 
        : null
      enriched.reschedule_approved_by_player = row.reschedule_approved_by
        ? playerMap.get(row.reschedule_approved_by) || null 
        : null
      enriched.reschedule_rejected_by_player = row.reschedule_rejected_by
        ? playerMap.get(row.reschedule_rejected_by) || null 
        : null
      
      // Flatten tournament_match if it exists
      if ('tournament_match' in match) {
        const tm = match.tournament_match
        if (Array.isArray(tm) && tm.length > 0) {
          enriched.tournament_match = tm[0]
        } else if (tm && !Array.isArray(tm)) {
          enriched.tournament_match = tm
        }
      }
      
      return enriched as MatchListRow
    })
    
    // Re-sort after enriching to ensure correct order (in case enrichment changed anything)
    // For completed matches, use played_at if available, otherwise scheduled_at
    // For other matches, use scheduled_at
    filteredData.sort((a, b) => {
      // Get the appropriate date for sorting
      const getSortDate = (match: MatchListRow) => {
        // For completed matches, prefer played_at if available, otherwise scheduled_at
        if (match.status === 'completed' && match.played_at) {
          return match.played_at
        }
        return match.scheduled_at
      }
      
      const dateAStr = getSortDate(a)
      const dateBStr = getSortDate(b)
      
      // Only compare if both have dates
      if (!dateAStr && !dateBStr) return 0
      if (!dateAStr) return 1 // Put matches without date at the end
      if (!dateBStr) return -1 // Put matches without date at the end
      
      // Parse dates and handle invalid dates
      const dateA = dateAStr ? new Date(dateAStr).getTime() : 0
      const dateB = dateBStr ? new Date(dateBStr).getTime() : 0
      
      // Handle invalid dates
      if (isNaN(dateA) && isNaN(dateB)) return 0
      if (isNaN(dateA)) return 1
      if (isNaN(dateB)) return -1
      
      // Descending order (newest first) - most recent date first
      return dateB - dateA
    })
    
    const total = typeof totalCount === 'number' ? totalCount : 0
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0
    
    return {
      matches: filteredData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/matches/index')
  }
})

