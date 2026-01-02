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
    // Using simplified syntax - Supabase will auto-detect foreign keys
    const { data, error } = await supabase
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
          name
        )
      `)
      .or(`player1_id.eq.${currentPlayer.id},player2_id.eq.${currentPlayer.id}`)
    
    if (error) {
      console.error('Error fetching matches:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: JSON.stringify(error, null, 2)
      })
      
      // If it's a foreign key relationship error, try a simpler query
      if (error.message?.includes('foreign key') || error.message?.includes('relation') || error.code === 'PGRST116') {
        console.log('Attempting fallback query without optional relationships...')
        // Fallback: simpler query without optional foreign keys
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:players(id, name, category:categories(id, name, description, order)),
            player2:players(id, name, category:categories(id, name, description, order)),
            pending_player2:pending_players(id, name, email, category:categories(id, name, description, order), status, invited_by_player_id),
            winner:players(id, name)
          `)
          .or(`player1_id.eq.${currentPlayer.id},player2_id.eq.${currentPlayer.id}`)
        
        if (fallbackError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to fetch matches: ${fallbackError.message || 'Unknown error'}`,
            data: {
              error: fallbackError.message,
              details: fallbackError.details,
              hint: fallbackError.hint,
              code: fallbackError.code,
              originalError: error.message
            }
          })
        }
        
        // Manually fetch related player data for optional fields
        const enrichedData = await Promise.all((fallbackData || []).map(async (match: any) => {
          const enriched: any = { ...match }
          
          // Fetch optional player relationships if they exist
          if (match.score_proposed_by) {
            const { data: player } = await supabase
              .from('players')
              .select('id, name')
              .eq('id', match.score_proposed_by)
              .single()
            enriched.score_proposed_by_player = player
          }
          
          if (match.score_approved_by) {
            const { data: player } = await supabase
              .from('players')
              .select('id, name')
              .eq('id', match.score_approved_by)
              .single()
            enriched.score_approved_by_player = player
          }
          
          if (match.reschedule_proposed_by) {
            const { data: player } = await supabase
              .from('players')
              .select('id, name')
              .eq('id', match.reschedule_proposed_by)
              .single()
            enriched.reschedule_proposed_by_player = player
          }
          
          if (match.reschedule_approved_by) {
            const { data: player } = await supabase
              .from('players')
              .select('id, name')
              .eq('id', match.reschedule_approved_by)
              .single()
            enriched.reschedule_approved_by_player = player
          }
          
          if (match.reschedule_rejected_by) {
            const { data: player } = await supabase
              .from('players')
              .select('id, name')
              .eq('id', match.reschedule_rejected_by)
              .single()
            enriched.reschedule_rejected_by_player = player
          }
          
          return enriched
        }))
        
        filteredData = enrichedData
      } else {
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
    }
    
    // Filter matches where user invited pending_player2 (can't do this in the query directly)
    let filteredData = (data || []).map((match: any) => {
      // Manually fetch optional player relationships
      const enriched: any = { ...match }
      
      // These will be fetched separately if needed to avoid foreign key issues
      enriched.score_proposed_by_player = null
      enriched.score_approved_by_player = null
      enriched.reschedule_proposed_by_player = null
      enriched.reschedule_approved_by_player = null
      enriched.reschedule_rejected_by_player = null
      
      return enriched
    })
    
    // Fetch optional player relationships separately to avoid foreign key constraint issues
    const enrichedPromises = filteredData.map(async (match: any) => {
      const enriched = { ...match }
      
      if (match.score_proposed_by) {
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', match.score_proposed_by)
          .single()
        enriched.score_proposed_by_player = player
      }
      
      if (match.score_approved_by) {
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', match.score_approved_by)
          .single()
        enriched.score_approved_by_player = player
      }
      
      if (match.reschedule_proposed_by) {
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', match.reschedule_proposed_by)
          .single()
        enriched.reschedule_proposed_by_player = player
      }
      
      if (match.reschedule_approved_by) {
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', match.reschedule_approved_by)
          .single()
        enriched.reschedule_approved_by_player = player
      }
      
      if (match.reschedule_rejected_by) {
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', match.reschedule_rejected_by)
          .single()
        enriched.reschedule_rejected_by_player = player
      }
      
      return enriched
    })
    
    filteredData = await Promise.all(enrichedPromises)
    
    // Get matches with pending_player2 where user is the inviter
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
          name
        )
      `)
      .not('pending_player2_id', 'is', null)
    
    if (!pendingError && pendingMatches) {
      // Filter to only include matches where user invited the pending_player2
      const userPendingMatches = pendingMatches.filter((match: any) => 
        match.pending_player2?.invited_by_player_id === currentPlayer.id
      )
      
      // Enrich with optional relationships
      const enrichedPendingMatches = await Promise.all(userPendingMatches.map(async (match: any) => {
        const enriched: any = { ...match }
        
        if (match.score_proposed_by) {
          const { data: player } = await supabase
            .from('players')
            .select('id, name')
            .eq('id', match.score_proposed_by)
            .single()
          enriched.score_proposed_by_player = player
        }
        
        if (match.reschedule_proposed_by) {
          const { data: player } = await supabase
            .from('players')
            .select('id, name')
            .eq('id', match.reschedule_proposed_by)
            .single()
          enriched.reschedule_proposed_by_player = player
        }
        
        return enriched
      }))
      
      // Merge and remove duplicates
      const existingIds = new Set(filteredData.map((m: any) => m.id))
      const newMatches = enrichedPendingMatches.filter((m: any) => !existingIds.has(m.id))
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

