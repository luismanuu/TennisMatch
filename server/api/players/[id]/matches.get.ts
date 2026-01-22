import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    const limit = parseInt(getQuery(event).limit as string) || 50
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Verify player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .single()
    
    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    // Fetch matches where player is player1 or player2
    const { data: matches, error: matchesError } = await supabase
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
          status
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
        )
      `)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (matchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch matches'
      })
    }
    
    // For competitive completed matches, get rating history
    const matchesWithRating = await Promise.all((matches || []).map(async (match: any) => {
      if (match.is_competitive && match.status === 'completed' && match.id) {
        try {
          // Get rating history for this match
          const { data: ratingHistory } = await supabase
            .from('rating_history')
            .select('player_id, elo_change, was_winner')
            .eq('match_id', match.id)
            .eq('rating_reversed', false)
            .eq('player_id', playerId)
            .single()
          
          if (ratingHistory) {
            match.elo_change = ratingHistory.elo_change
            match.was_winner = ratingHistory.was_winner
          }
        } catch (err) {
          // Silently fail - rating history is optional
        }
      }
      return match
    }))
    
    return {
      success: true,
      matches: matchesWithRating || []
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
