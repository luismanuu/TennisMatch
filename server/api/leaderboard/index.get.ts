import { and, count, eq, ilike, sql, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { findPlayerByUserId, getSessionUser } from '~/server/utils/session'
import { RATING_TIERS } from '~/server/utils/rating-system'
import { eloBetween, orderedBefore, rankedPlayers, rankedRows } from '~/server/utils/ranking'
import type { RatingTier } from '~/types'
import type { LeaderboardResponse } from '~/types/leaderboard'

// Ranked players only, each with the global rank (server/utils/ranking.ts). Filters choose rows, never renumber them.
export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
  // Public; a signed-in viewer's own row is marked. The viewer comes from the session, never the query.
  const viewer = await getSessionUser(event)
  const currentPlayerId = viewer ? (await findPlayerByUserId(viewer.id))?.id : undefined

  try {
    const query = getQuery(event)
    const tier = query.tier as RatingTier | undefined
    const cityId = query.city_id as string | undefined
    const search = query.search as string | undefined
    const limit = Math.max(1, Math.min(query.limit ? parseInt(query.limit as string) || 50 : 50, 100))
    const requestedOffset = Math.max(0, query.offset ? parseInt(query.offset as string) || 0 : 0)
    const centerAroundPlayer = query.center_around_player === 'true'

    const db = useDb()

    const viewerRow = currentPlayerId
      ? (await db.select({ id: players.id, elo: players.elo }).from(players).where(and(rankedPlayers, eq(players.id, currentPlayerId))))[0]
      : undefined

    const conditions: SQL[] = [rankedPlayers]
    if (cityId) conditions.push(eq(players.city_id, cityId))
    if (search && search.trim()) conditions.push(ilike(players.name, `%${search.trim()}%`))
    const tierInfo = tier ? RATING_TIERS.find((t) => t.tier === tier) : undefined
    if (tierInfo) {
      conditions.push(eloBetween(tierInfo.minElo, tierInfo.maxElo))
    } else if (centerAroundPlayer && viewerRow) {
      // Without a tier, the window around the viewer shows players within ±200 SR
      conditions.push(eloBetween(viewerRow.elo - 200, viewerRow.elo + 200))
    }
    const filter = and(...conditions)!

    const [{ n: total }] = await db.select({ n: count() }).from(players).where(filter)

    let offset = requestedOffset
    if (centerAroundPlayer && viewerRow) {
      const [{ n: before }] = await db.select({ n: count() }).from(players).where(and(filter, orderedBefore(viewerRow.elo, viewerRow.id)))
      const viewerInList = (await db.select({ n: sql<number>`1` }).from(players).where(and(filter, eq(players.id, viewerRow.id)))).length > 0
      if (viewerInList) offset = Math.max(0, Math.min(before - Math.floor(limit / 2), total - limit))
    }

    const rankings = await rankedRows(db, { filter, limit, offset, viewerId: currentPlayerId })

    let currentUserPosition = rankings.find((p) => p.is_current_user) ?? null
    if (!currentUserPosition && viewerRow) {
      const [before] = await db.select({ n: count() }).from(players).where(and(filter, orderedBefore(viewerRow.elo, viewerRow.id)))
      const [own] = await rankedRows(db, { filter: and(filter, eq(players.id, viewerRow.id)), limit: 1, viewerId: currentPlayerId })
      currentUserPosition = own ? { ...own, position: before.n + 1 } : null
    }

    return {
      success: true,
      rankings,
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      filters: { tier, city_id: cityId, search, limit, offset },
      current_user_position: currentUserPosition,
    }
  } catch (error: any) {
    console.error('Leaderboard error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
