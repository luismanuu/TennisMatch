import { and, count, eq, gte, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { RATING_TIERS } from '~/server/utils/rating-system'
import { eloBetween, rankedPlayers, rankedRows } from '~/server/utils/ranking'
import type { RatingTier } from '~/types'

// Ranked players with their global rank (server/utils/ranking.ts). Tier and city filter in SQL, before paging.
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id as string | undefined
    const limit = Math.max(1, Math.min(query.limit ? parseInt(query.limit as string) || 100 : 100, 200))
    const offset = Math.max(0, query.offset ? parseInt(query.offset as string) || 0 : 0)
    const minMatches = Math.max(1, query.min_matches ? parseInt(query.min_matches as string) || 1 : 1)

    const db = useDb()
    const conditions: SQL[] = [rankedPlayers, gte(players.total_matches_played, minMatches)]
    if (cityId) conditions.push(eq(players.city_id, cityId))
    const tierInfo = tier ? RATING_TIERS.find((t) => t.tier === tier) : undefined
    if (tierInfo) conditions.push(eloBetween(tierInfo.minElo, tierInfo.maxElo))
    const filter = and(...conditions)!

    const rankings = await rankedRows(db, { filter, limit, offset })
    const [{ n: total }] = await db.select({ n: count() }).from(players).where(filter)

    return {
      success: true,
      rankings,
      total,
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
