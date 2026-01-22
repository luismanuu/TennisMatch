import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const matchId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!matchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Match ID is required'
      })
    }
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }
    
    // Verify Clerk user exists
    await getClerkUser(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Get current player
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()
    
    if (playerError || !currentPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Player not found'
      })
    }
    
    // Get match to verify user is involved
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, status, is_competitive')
      .eq('id', matchId)
      .single()
    
    if (matchError || !match) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Match not found'
      })
    }
    
    // Verify user is involved in the match
    if (match.player1_id !== currentPlayer.id && match.player2_id !== currentPlayer.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only view rating history for matches you participated in'
      })
    }
    
    // Only return rating history for competitive matches
    if (!match.is_competitive || match.status !== 'completed') {
      return {
        success: true,
        rating_history: null
      }
    }
    
    // Get rating history for both players for this match
    const { data: ratingHistory, error: historyError } = await supabase
      .from('rating_history')
      .select(`
        id,
        player_id,
        elo_before,
        elo_after,
        elo_change,
        was_winner,
        is_placement_match
      `)
      .eq('match_id', matchId)
      .eq('rating_reversed', false)
      .order('created_at', { ascending: true })
    
    if (historyError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rating history',
        data: historyError
      })
    }
    
    if (!ratingHistory || ratingHistory.length === 0) {
      return {
        success: true,
        rating_history: null
      }
    }
    
    // Get player data
    const player1History = ratingHistory.find(h => h.player_id === match.player1_id)
    const player2History = ratingHistory.find(h => h.player_id === match.player2_id)
    
    return {
      success: true,
      rating_history: {
        player1: player1History ? {
          elo_change: player1History.elo_change,
          elo_before: player1History.elo_before,
          elo_after: player1History.elo_after
        } : null,
        player2: player2History ? {
          elo_change: player2History.elo_change,
          elo_before: player2History.elo_before,
          elo_after: player2History.elo_after
        } : null
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
