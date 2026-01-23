import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerk_id = query.clerk_id as string
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit
    const status = query.status as string | undefined
    // Default: show matches from last 24 hours if no date filters are set
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined
    const skip24hFilter = query.skip_24h_filter === 'true'
    
    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }
    
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
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
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
      `)
      .or(`player1_id.eq.${currentPlayer.id},player2_id.eq.${currentPlayer.id}`)
    
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
    
    const { data: allMatches, error: matchesError } = await matchesQuery
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    
    if (matchesError) {
      console.error('Error fetching matches:', {
        message: matchesError.message,
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
    
    // Also fetch matches where user invited a pending_player2
    let pendingMatchesQuery = supabase
      .from('matches')
      .select(`
        *,
        player1:players!player1_id(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!player2_id(
          id,
          name,
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
      `)
      .not('pending_player2_id', 'is', null)
    
    // Apply same filters to pending matches query
    if (status) {
      pendingMatchesQuery = pendingMatchesQuery.eq('status', status)
    } else {
      pendingMatchesQuery = pendingMatchesQuery.neq('status', 'cancelled')
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
        pendingMatchesQuery = pendingMatchesQuery.or(dateFilter)
      }
    }
    
    // Don't apply 24-hour filter to pending matches query - it should show all pending matches
    
    const { data: pendingMatches, error: pendingError } = await pendingMatchesQuery
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    
    // Combine matches and filter pending matches where user is the inviter
    let filteredData = (allMatches || []).map((match: any) => ({ ...match }))
    
    if (!pendingError && pendingMatches) {
      // Filter to only include matches where user invited the pending_player2
      const userPendingMatches = pendingMatches.filter((match: any) => 
        match.pending_player2?.invited_by_player_id === currentPlayer.id
      )
      
      // Merge and remove duplicates
      const existingIds = new Set(filteredData.map((m: any) => m.id))
      const newMatches = userPendingMatches.filter((m: any) => !existingIds.has(m.id))
      filteredData = [...filteredData, ...newMatches]
    }
    
    // Sort by scheduled_at descending BEFORE enriching (to maintain order)
    // This ensures proper ordering even after merging results from different queries
    // For completed matches, use played_at if available, otherwise scheduled_at
    filteredData.sort((a: any, b: any) => {
      // Get the appropriate date for sorting
      const getSortDate = (match: any) => {
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
    filteredData.forEach((match: any) => {
      if (match.match_proposed_by) allPlayerIds.add(match.match_proposed_by)
      if (match.match_accepted_by) allPlayerIds.add(match.match_accepted_by)
      if (match.match_rejected_by) allPlayerIds.add(match.match_rejected_by)
      if (match.acceptance_change_approved_by) allPlayerIds.add(match.acceptance_change_approved_by)
      if (match.acceptance_change_rejected_by) allPlayerIds.add(match.acceptance_change_rejected_by)
      if (match.score_proposed_by) allPlayerIds.add(match.score_proposed_by)
      if (match.score_approved_by) allPlayerIds.add(match.score_approved_by)
      if (match.reschedule_proposed_by) allPlayerIds.add(match.reschedule_proposed_by)
      if (match.reschedule_approved_by) allPlayerIds.add(match.reschedule_approved_by)
      if (match.reschedule_rejected_by) allPlayerIds.add(match.reschedule_rejected_by)
    })
    
    // Batch fetch all optional player relationships in a single query
    let playerMap = new Map<string, { id: string; name: string }>()
    if (allPlayerIds.size > 0) {
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', Array.from(allPlayerIds))
      
      if (!playersError && players) {
        playerMap = new Map(players.map((p: any) => [p.id, p]))
      }
    }
    
    // Enrich matches with optional player relationships using the batched data
    filteredData = filteredData.map((match: any) => {
      const enriched: any = { ...match }
      
      enriched.match_proposed_by_player = match.match_proposed_by 
        ? playerMap.get(match.match_proposed_by) || null 
        : null
      enriched.match_accepted_by_player = match.match_accepted_by 
        ? playerMap.get(match.match_accepted_by) || null 
        : null
      enriched.match_rejected_by_player = match.match_rejected_by 
        ? playerMap.get(match.match_rejected_by) || null 
        : null
      enriched.acceptance_change_approved_by_player = match.acceptance_change_approved_by 
        ? playerMap.get(match.acceptance_change_approved_by) || null 
        : null
      enriched.acceptance_change_rejected_by_player = match.acceptance_change_rejected_by 
        ? playerMap.get(match.acceptance_change_rejected_by) || null 
        : null
      enriched.score_proposed_by_player = match.score_proposed_by 
        ? playerMap.get(match.score_proposed_by) || null 
        : null
      enriched.score_approved_by_player = match.score_approved_by 
        ? playerMap.get(match.score_approved_by) || null 
        : null
      enriched.reschedule_proposed_by_player = match.reschedule_proposed_by 
        ? playerMap.get(match.reschedule_proposed_by) || null 
        : null
      enriched.reschedule_approved_by_player = match.reschedule_approved_by 
        ? playerMap.get(match.reschedule_approved_by) || null 
        : null
      enriched.reschedule_rejected_by_player = match.reschedule_rejected_by 
        ? playerMap.get(match.reschedule_rejected_by) || null 
        : null
      
      // Flatten tournament_match if it exists
      if (match.tournament_match && Array.isArray(match.tournament_match) && match.tournament_match.length > 0) {
        enriched.tournament_match = match.tournament_match[0]
      } else if (match.tournament_match && !Array.isArray(match.tournament_match)) {
        enriched.tournament_match = match.tournament_match
      }
      
      return enriched
    })
    
    // Re-sort after enriching to ensure correct order (in case enrichment changed anything)
    // For completed matches, use played_at if available, otherwise scheduled_at
    // For other matches, use scheduled_at
    filteredData.sort((a: any, b: any) => {
      // Get the appropriate date for sorting
      const getSortDate = (match: any) => {
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
    
    // Calculate pagination
    const total = filteredData.length
    const totalPages = Math.ceil(total / limit)
    const paginatedData = filteredData.slice(offset, offset + limit)
    
    return {
      matches: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    }
  } catch (error: any) {
    console.error('Unexpected error in matches endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

