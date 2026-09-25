import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import { getRatingTier } from '~/server/utils/rating-system'
import type { RatingTier } from '~/types'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const cityId = query.city_id as string | undefined
    const categoryId = query.category_id as string | undefined
    const tier = query.tier as RatingTier | undefined
    const search = query.search as string | undefined
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 100, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    const exportFormat = query.export as string | undefined // 'csv' or 'json'

    const db = useDb()

    // Build filters
    const conditions = [eq(players.status, 'active'), isNull(players.deleted_at)]
    if (cityId) conditions.push(eq(players.city_id, cityId))
    if (categoryId) conditions.push(eq(players.category_id, categoryId))
    if (search && search.trim()) conditions.push(ilike(players.name, `%${search.trim()}%`))
    const where = and(...conditions)!

    // Get total count
    const [{ n: totalCount }] = await db.select({ n: count() }).from(players).where(where)

    // Apply pagination
    const rows = await db.query.players.findMany({
      where,
      orderBy: [desc(players.elo), asc(players.id)],
      limit,
      offset,
      columns: {
        id: true,
        name: true,
        elo: true,
        total_matches_played: true,
        placement_matches_completed: true,
        win_streak: true,
        loss_streak: true,
      },
      with: {
        city: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    })

    if (!rows) {
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
          search,
        },
      }
    }

    // Calculate ranks and add tier information
    let rankings = rows.map((player, index) => {
      const tierInfo = getRatingTier(player.elo || 0)
      const isInPlacement = (player.total_matches_played || 0) === 0 || (player.placement_matches_completed || 0) < 3

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
        city: player.city as any,
        category: player.category as any,
      }
    })

    // Apply tier filter after ranking calculation
    if (tier) {
      rankings = rankings.filter((r) => r.rating_tier === tier)
    }

    // Handle export
    if (exportFormat === 'csv') {
      const csvHeaders = ['Rank', 'Name', 'ELO', 'Tier', 'Matches', 'Win Streak', 'City', 'Category']
      const csvRows = rankings.map((r) => [
        r.rank,
        r.name,
        r.elo,
        r.rating_tier,
        r.total_matches_played,
        r.win_streak,
        (r.city as any)?.name || 'N/A',
        (r.category as any)?.name || 'N/A',
      ])

      const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')

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
          search,
        },
        exported_at: new Date().toISOString(),
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
        search,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error,
    })
  }
})
