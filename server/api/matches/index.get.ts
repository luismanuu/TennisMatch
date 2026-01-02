import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerk_id = query.clerk_id as string
    
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
      return []
    }
    
    // Fetch only matches where user is player1 or player2
    // Also include matches where user invited a pending_player2
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:players!matches_player1_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!matches_player2_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status,
          invited_by_player_id
        ),
        score_proposed_by_player:players!matches_score_proposed_by_fkey(
          id,
          name
        ),
        score_approved_by_player:players!matches_score_approved_by_fkey(
          id,
          name
        ),
        winner:players!matches_winner_id_fkey(
          id,
          name
        )
      `)
      .or(`player1_id.eq.${currentPlayer.id},player2_id.eq.${currentPlayer.id}`)
    
    if (error) {
      console.error('Error fetching matches:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch matches: ${error.message || 'Unknown error'}`,
        data: {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }
      })
    }
    
    // Filter matches where user invited pending_player2 (can't do this in the query directly)
    let filteredData = data || []
    
    // Get matches with pending_player2 where user is the inviter
    const { data: pendingMatches, error: pendingError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:players!matches_player1_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        player2:players!matches_player2_id_fkey(
          id,
          name,
          category:categories(id, name, description, order)
        ),
        pending_player2:pending_players(
          id,
          name,
          email,
          category:categories(id, name, description, order),
          status,
          invited_by_player_id
        ),
        score_proposed_by_player:players!matches_score_proposed_by_fkey(
          id,
          name
        ),
        score_approved_by_player:players!matches_score_approved_by_fkey(
          id,
          name
        ),
        winner:players!matches_winner_id_fkey(
          id,
          name
        )
      `)
      .not('pending_player2_id', 'is', null)
    
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
    
    // Sort by scheduled_at descending
    filteredData.sort((a: any, b: any) => {
      const dateA = new Date(a.scheduled_at || a.created_at).getTime()
      const dateB = new Date(b.scheduled_at || b.created_at).getTime()
      return dateB - dateA
    })
    
    return filteredData
  } catch (error: any) {
    console.error('Unexpected error in matches endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

