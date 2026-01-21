import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerk_id = query.clerk_id as string
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit
    
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
    
    // Fetch all matches where user is player1, player2, or invited a pending_player2
    // Use a single query with OR condition to get all relevant matches
    const { data: allMatches, error: matchesError } = await supabase
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
    const { data: pendingMatches, error: pendingError } = await supabase
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
    
    // Sort by scheduled_at descending
    filteredData.sort((a: any, b: any) => {
      const dateA = new Date(a.scheduled_at || a.created_at).getTime()
      const dateB = new Date(b.scheduled_at || b.created_at).getTime()
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

