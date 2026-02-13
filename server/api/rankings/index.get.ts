import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'
import { rankingsQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

interface RankingPlayer {
  id: string
  name: string
  elo: number
  total_matches_played: number
  placement_matches_completed: number | null
  city: { id: string; name: string } | null
  category: { id: string; name: string } | null
  rank: number
  rating_tier: RatingTier
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(rankingsQuerySchema, getQuery(event))
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id
    const limit = query.limit ?? 100
    const offset = query.offset ?? 0
    const minMatches = query.min_matches ?? 1 // Only show players with at least 1 match
    
    const supabase = getSupabaseAdmin()
    
    // Optional tier filter pushed to DB via ELO range
    let minElo: number | null = null
    let maxElo: number | null = null
    if (tier) {
      const tierInfo = RATING_TIERS.find(t => t.tier === tier)
      if (tierInfo) {
        minElo = tierInfo.minElo
        maxElo = Number.isFinite(tierInfo.maxElo) ? tierInfo.maxElo : null
      }
    }

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

    if (minElo !== null) queryBuilder = queryBuilder.gte('elo', minElo)
    if (maxElo !== null) queryBuilder = queryBuilder.lte('elo', maxElo)
    
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
    const rankings: RankingPlayer[] = (players as unknown as Array<{
      id: string
      name: string
      elo: number
      total_matches_played: number
      placement_matches_completed: number | null
      city: { id: string; name: string } | null
      category: { id: string; name: string } | null
    }>).map((player, index) => {
      const ratingTierInfo = getRatingTier(player.elo)
      
      return {
        id: player.id,
        name: player.name,
        elo: player.elo,
        total_matches_played: player.total_matches_played,
        placement_matches_completed: player.placement_matches_completed,
        city: player.city,
        category: player.category,
        rank: offset + index + 1,
        rating_tier: ratingTierInfo.tier
      }
    })
    
    // Get total count for pagination
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .gte('total_matches_played', minMatches)
    
    if (cityId) {
      countQuery = countQuery.eq('city_id', cityId)
    }

    if (minElo !== null) countQuery = countQuery.gte('elo', minElo)
    if (maxElo !== null) countQuery = countQuery.lte('elo', maxElo)
    
    const { count } = await countQuery
    
    return {
      success: true,
      rankings,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: {
        tier: tier || null,
        city_id: cityId || null,
        min_matches: minMatches
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/rankings/index')
  }
})
