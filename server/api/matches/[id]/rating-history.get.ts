import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { checkIsAdmin } from '~/server/utils/admin'

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
    
    // Check if user is admin
    const isAdmin = await checkIsAdmin(clerkId)
    
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
    
    // Verify user is involved in the match OR is admin
    if (!isAdmin && match.player1_id !== currentPlayer.id && match.player2_id !== currentPlayer.id) {
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
    
    // Get rating history for both players for this match (only non-reversed entries)
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
    
    // Check if we have rating history entries (even if reversed) to detect if match was reprocessed
    const { data: allHistoryEntries } = await supabase
      .from('rating_history')
      .select('id, rating_reversed')
      .eq('match_id', matchId)
      .limit(1)
    
    // If no rating history exists at all, return null (ELO not calculated yet)
    if (!ratingHistory || ratingHistory.length === 0) {
      // If there are reversed entries but no non-reversed ones, it means recalculation is in progress
      // or failed - we should still return null so frontend shows "Calculando ELO..."
      const hasReversedEntries = allHistoryEntries && allHistoryEntries.some((h: any) => h.rating_reversed)
      if (hasReversedEntries) {
        // Match was reprocessed but new entries not created yet - return null to show calculating state
        // The frontend will continue polling until new entries are created
        return {
          success: true,
          rating_history: null
        }
      }
      
      return {
        success: true,
        rating_history: null
      }
    }
    
    // Get player data - ensure we have entries for both players
    const player1History = ratingHistory.find(h => h.player_id === match.player1_id)
    const player2History = ratingHistory.find(h => h.player_id === match.player2_id)
    
    // If we only have one player's history, it might be incomplete - return what we have
    // This can happen if rating history creation was interrupted, but we'll return partial data
    
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
