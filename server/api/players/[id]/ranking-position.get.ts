import { and, count, eq, gt, gte, inArray } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, players } from '~/server/db/schema'
import { getRatingTier } from '~/server/utils/rating-system'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const playerId = getRouterParam(event, 'id')

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }

  try {
    const db = useDb()

    const player = UUID.test(playerId)
      ? await db.query.players.findFirst({
          columns: { id: true, elo: true, city_id: true, total_matches_played: true },
          where: eq(players.id, playerId),
        })
      : undefined

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    // Only calculate rank for rated players
    if (player.total_matches_played === 0) {
      return { success: true, is_unrated: true, position: null }
    }

    const rated = and(eq(players.status, 'active'), gte(players.total_matches_played, 1))

    const [{ n: totalPlayersRaw }] = await db.select({ n: count() }).from(players).where(rated)
    const actualTotalPlayers = totalPlayersRaw > 0 ? totalPlayersRaw : 1

    const [{ n: playersAbove }] = await db
      .select({ n: count() })
      .from(players)
      .where(and(rated, gt(players.elo, player.elo)))

    const globalRank = playersAbove + 1
    const playersBelow = Math.max(0, actualTotalPlayers - globalRank)
    const percentile = actualTotalPlayers === 1 ? 100 : Math.round(((actualTotalPlayers - globalRank) / actualTotalPlayers) * 100)

    const position: RankingPosition = {
      global_rank: globalRank,
      total_players: actualTotalPlayers,
      players_above: playersAbove,
      players_below: playersBelow,
      percentile,
    }

    // Segment rank, if the player's city belongs to one
    if (player.city_id) {
      const segmentCities = await db.query.city_segment_cities.findMany({
        columns: { city_segment_id: true },
        with: { city_segment: { columns: { name: true } } },
        where: eq(city_segment_cities.city_id, player.city_id),
        limit: 1,
      })

      if (segmentCities.length > 0) {
        const segmentId = segmentCities[0].city_segment_id
        const segmentName = segmentCities[0].city_segment?.name ?? 'Segmento'

        const cityRows = await db.query.city_segment_cities.findMany({
          columns: { city_id: true },
          where: eq(city_segment_cities.city_segment_id, segmentId),
        })
        const cityIds = cityRows.map((c) => c.city_id)

        if (cityIds.length > 0) {
          const [{ n: segmentTotal }] = await db
            .select({ n: count() })
            .from(players)
            .where(and(rated, inArray(players.city_id, cityIds)))

          const [{ n: segmentPlayersAbove }] = await db
            .select({ n: count() })
            .from(players)
            .where(and(rated, inArray(players.city_id, cityIds), gt(players.elo, player.elo)))

          position.segment_rank = segmentPlayersAbove + 1
          position.segment_total = segmentTotal
          position.segment_name = segmentName
        }
      }
    }

    // Tier rank
    const tierInfo = getRatingTier(player.elo)
    const tier = tierInfo.tier

    const allPlayers = await db.query.players.findMany({
      columns: { id: true, elo: true },
      where: rated,
      orderBy: (t, { desc }) => desc(t.elo),
    })

    const tierPlayers = allPlayers.filter((p) => getRatingTier(p.elo).tier === tier)
    const tierPlayersAbove = tierPlayers.filter((p) => p.elo > player.elo).length
    position.tier_rank = tierPlayersAbove + 1
    position.tier_total = tierPlayers.length

    return {
      success: true,
      is_unrated: false,
      position,
      tier,
      current_players: actualTotalPlayers,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
