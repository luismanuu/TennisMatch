import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier } from '~/server/utils/rating-system'
import type { Player, RatingTier } from '~/types'

interface RankingPlayer extends Player {
  rank: number
  rating_tier: RatingTier
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id as string | undefined
    const limit = query.limit ? parseInt(query.limit as string) : 100
    const offset = query.offset ? parseInt(query.offset as string) : 0
    const minMatches = query.min_matches ? parseInt(query.min_matches as string) : 1 // Only show players with at least 1 match
    
    const supabase = getSupabaseAdmin()
    
    // Build query
    let queryBuilder = supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('deleted', false)
      .gte('total_matches_played', minMatches) // Only rated players
      .order('elo', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (cityId) {
      queryBuilder = queryBuilder.eq('city_id', cityId)
    }
    
    const { data: players, error } = await queryBuilder
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch rankings',
        data: error
      })
    }
    
    if (!players) {
      return {
        success: true,
        rankings: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit
      }
    }
    
    // Calculate ranks and add tier information
    const rankings: RankingPlayer[] = players.map((player, index) => {
      const ratingTierInfo = getRatingTier(player.elo)
      
      return {
        ...player,
        rank: offset + index + 1,
        rating_tier: ratingTierInfo.tier
      } as RankingPlayer
    })
    
    // Filter by tier if specified (after ranking calculation)
    const filteredRankings = tier 
      ? rankings.filter(p => p.rating_tier === tier)
      : rankings
    
    // Get total count for pagination
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .gte('total_matches_played', minMatches)
    
    if (cityId) {
      countQuery = countQuery.eq('city_id', cityId)
    }
    
    const { count } = await countQuery
    
    return {
      success: true,
      rankings: filteredRankings,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: {
        tier: tier || null,
        city_id: cityId || null,
        min_matches: minMatches
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
