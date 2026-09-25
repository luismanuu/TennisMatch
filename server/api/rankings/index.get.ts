import { and, asc, count, desc, eq, gte, isNull } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
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

    const db = useDb()

    // Active, not deleted (players never had a `deleted` column).
    const conditions = [eq(players.status, 'active'), isNull(players.deleted_at), gte(players.total_matches_played, minMatches)]
    if (cityId) conditions.push(eq(players.city_id, cityId))
    const where = and(...conditions)!

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
      },
      with: {
        city: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    })

    if (!rows) {
      return {
        success: true,
        rankings: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
      }
    }

    // Calculate ranks and add tier information
    const rankings: RankingPlayer[] = rows.map((player, index) => {
      const ratingTierInfo = getRatingTier(player.elo)

      return {
        ...player,
        rank: offset + index + 1,
        rating_tier: ratingTierInfo.tier,
      } as unknown as RankingPlayer
    })

    // Filter by tier if specified (after ranking calculation)
    const filteredRankings = tier ? rankings.filter((p) => p.rating_tier === tier) : rankings

    // Get total count for pagination
    const [{ n: totalCount }] = await db.select({ n: count() }).from(players).where(where)

    return {
      success: true,
      rankings: filteredRankings,
      total: totalCount || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: {
        tier: tier || null,
        city_id: cityId || null,
        min_matches: minMatches,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
