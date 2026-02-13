import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getRatingTier, RATING_TIERS } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'
import { adminRankingsLeaderboardsQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

type CityRef = { id: string; name: string }
type CategoryRef = { id: string; name: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toCityRef(value: unknown): CityRef | null {
  const r = asRecord(value)
  if (!r) return null
  return typeof r.id === 'string' && typeof r.name === 'string' ? { id: r.id, name: r.name } : null
}

function toCategoryRef(value: unknown): CategoryRef | null {
  const r = asRecord(value)
  if (!r) return null
  return typeof r.id === 'string' && typeof r.name === 'string' ? { id: r.id, name: r.name } : null
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminRankingsLeaderboardsQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const cityId = query.city_id
    const categoryId = query.category_id
    const tier = query.tier as RatingTier | undefined
    const search = query.search
    const limit = query.limit ?? 100
    const offset = query.offset ?? 0
    const exportFormat = query.export

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Push tier filter down into DB via ELO range (so totals match)
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
        win_streak,
        loss_streak,
        city:cities(id, name),
        category:categories(id, name)
      `)
      .eq('status', 'active')
      .order('elo', { ascending: false })

    // Apply filters
    if (cityId) {
      queryBuilder = queryBuilder.eq('city_id', cityId)
    }

    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId)
    }

    if (search && search.trim()) {
      queryBuilder = queryBuilder.ilike('name', `%${search.trim()}%`)
    }

    if (minElo !== null) queryBuilder = queryBuilder.gte('elo', minElo)
    if (maxElo !== null) queryBuilder = queryBuilder.lte('elo', maxElo)

    // Get total count
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    if (cityId) {
      countQuery = countQuery.eq('city_id', cityId)
    }
    if (categoryId) {
      countQuery = countQuery.eq('category_id', categoryId)
    }
    if (search && search.trim()) {
      countQuery = countQuery.ilike('name', `%${search.trim()}%`)
    }

    if (minElo !== null) countQuery = countQuery.gte('elo', minElo)
    if (maxElo !== null) countQuery = countQuery.lte('elo', maxElo)

    const { count: totalCount } = await countQuery

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1)

    const { data: players, error: playersError } = await queryBuilder

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch leaderboard',
        data: playersError
      })
    }

    if (!players) {
      return {
        success: true,
        leaderboard: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        filters: {
          city_id: cityId,
          category_id: categoryId,
          tier,
          search
        }
      }
    }

    // Calculate ranks and add tier information
    const rankings: Array<{
      id: string
      name: string | null
      elo: number
      rank: number
      rating_tier: string
      tier_color: string
      total_matches_played: number
      win_streak: number
      loss_streak: number
      placement_matches_completed: number
      is_in_placement: boolean
      city: CityRef | null
      category: CategoryRef | null
    }> = players.map((player, index) => {
      const tierInfo = getRatingTier(player.elo || 0)
      const isInPlacement = (player.total_matches_played || 0) === 0 || 
        ((player.placement_matches_completed || 0) < 3)
      
      return {
        id: player.id,
        name: player.name,
        elo: player.elo || 0,
        rank: offset + index + 1,
        rating_tier: tierInfo.tier,
        tier_color: tierInfo.color,
        total_matches_played: player.total_matches_played || 0,
        win_streak: player.win_streak || 0,
        loss_streak: player.loss_streak || 0,
        placement_matches_completed: player.placement_matches_completed || 0,
        is_in_placement: isInPlacement,
        city: toCityRef(player.city),
        category: toCategoryRef(player.category)
      }
    })

    // Handle export
    if (exportFormat === 'csv') {
      const csvHeaders = ['Rank', 'Name', 'ELO', 'Tier', 'Matches', 'Win Streak', 'City', 'Category']
      const csvRows = rankings.map(r => [
        r.rank,
        r.name,
        r.elo,
        r.rating_tier,
        r.total_matches_played,
        r.win_streak,
        r.city?.name || 'N/A',
        r.category?.name || 'N/A'
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      setHeader(event, 'Content-Type', 'text/csv')
      setHeader(event, 'Content-Disposition', `attachment; filename="leaderboard-${Date.now()}.csv"`)
      return csvContent
    }

    if (exportFormat === 'json') {
      setHeader(event, 'Content-Type', 'application/json')
      setHeader(event, 'Content-Disposition', `attachment; filename="leaderboard-${Date.now()}.json"`)
      return {
        success: true,
        leaderboard: rankings,
        total: totalCount || 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        filters: {
          city_id: cityId,
          category_id: categoryId,
          tier,
          search
        },
        exported_at: new Date().toISOString()
      }
    }

    return {
      success: true,
      leaderboard: rankings,
      total: totalCount || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: {
        city_id: cityId,
        category_id: categoryId,
        tier,
        search
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/rankings/leaderboards')
  }
})
