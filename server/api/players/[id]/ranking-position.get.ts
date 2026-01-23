import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'

interface RankingPosition {
  global_rank: number
  total_players: number
  segment_rank?: number
  segment_total?: number
  segment_name?: string
  tier_rank?: number
  tier_total?: number
  players_above: number
  players_below: number
  percentile: number
}

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch player data with city info
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, elo, city_id, total_matches_played, city:cities(id, name)')
      .eq('id', playerId)
      .single()
    
    if (playerError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    // Only calculate rank for rated players
    if (player.total_matches_played === 0) {
      return {
        success: true,
        is_unrated: true,
        position: null
      }
    }
    
    // Get total number of rated players (including the current player)
    // Use status = 'active' instead of deleted = false
    const { count: totalPlayers, error: countError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('total_matches_played', 1)
    
    if (countError) {
      console.error('Error counting players:', countError)
    }
    
    // If count fails or returns 0, but player has matches, assume at least 1 (the player themselves)
    // Always show ranking if player has matches, even if count is 0
    const actualTotalPlayers = (totalPlayers && totalPlayers > 0) ? totalPlayers : 1
    
    // Get global rank (players with higher ELO + 1)
    const { count: playersAbove } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('total_matches_played', 1)
      .gt('elo', player.elo)
    
    const globalRank = (playersAbove || 0) + 1
    const playersBelow = Math.max(0, actualTotalPlayers - globalRank)
    // Calculate percentile: if only 1 player, they're in top 100%, otherwise calculate normally
    const percentile = actualTotalPlayers === 1 ? 100 : Math.round(((actualTotalPlayers - globalRank) / actualTotalPlayers) * 100)
    
    const position: RankingPosition = {
      global_rank: globalRank,
      total_players: actualTotalPlayers,
      players_above: playersAbove || 0,
      players_below: playersBelow,
      percentile
    }
    
    // Get segment rank if player has a city
    if (player.city_id) {
      // Find which segment(s) contain this player's city
      const { data: segmentCities } = await supabase
        .from('city_segment_cities')
        .select('city_segment_id, city_segment:city_segments(id, name)')
        .eq('city_id', player.city_id)
        .limit(1) // Use the first segment if city is in multiple segments
      
      if (segmentCities && segmentCities.length > 0) {
        const segmentId = segmentCities[0].city_segment_id
        const segmentName = (segmentCities[0].city_segment as any)?.name || 'Segmento'
        
        // Get all cities in this segment
        const { data: segmentCityIds } = await supabase
          .from('city_segment_cities')
          .select('city_id')
          .eq('city_segment_id', segmentId)
        
        if (segmentCityIds && segmentCityIds.length > 0) {
          const cityIds = segmentCityIds.map(sc => sc.city_id)
          
          // Count total players in this segment
          const { count: segmentTotal } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .in('city_id', cityIds)
            .gte('total_matches_played', 1)
          
          // Count players above in this segment
          const { count: segmentPlayersAbove } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .in('city_id', cityIds)
            .gte('total_matches_played', 1)
            .gt('elo', player.elo)
          
          position.segment_rank = (segmentPlayersAbove || 0) + 1
          position.segment_total = segmentTotal || 0
          position.segment_name = segmentName
        }
      }
    }
    
    // Get tier rank
    const tierInfo = getRatingTier(player.elo)
    const tier = tierInfo.tier
    
    // Get all players in the same tier to calculate tier rank
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, elo')
      .eq('status', 'active')
      .gte('total_matches_played', 1)
      .order('elo', { ascending: false })
    
    if (allPlayers) {
      const tierPlayers = allPlayers.filter(p => {
        const pTier = getRatingTier(p.elo)
        return pTier.tier === tier
      })
      
      const tierPlayersAbove = tierPlayers.filter(p => p.elo > player.elo).length
      
      position.tier_rank = tierPlayersAbove + 1
      position.tier_total = tierPlayers.length
    }
    
    return {
      success: true,
      is_unrated: false,
      position,
      tier,
      current_players: actualTotalPlayers
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
