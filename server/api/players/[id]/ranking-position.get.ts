import { eq, inArray } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, players } from '~/server/db/schema'
import { getRatingTier } from '~/server/utils/rating-system'
import { eloBetween, rankOf, rankedCount } from '~/server/utils/ranking'

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

    // Rank as defined in server/utils/ranking.ts; a player with no rated match has none
    if (!player.total_matches_played) {
      return { success: true, is_unrated: true, position: null }
    }

    const totalPlayers = Math.max(1, await rankedCount(db))
    const globalRank = await rankOf(db, player.elo)
    const playersAbove = globalRank - 1
    const playersBelow = Math.max(0, totalPlayers - globalRank)
    const percentile = totalPlayers === 1 ? 100 : Math.round(((totalPlayers - globalRank) / totalPlayers) * 100)

    const position: RankingPosition = {
      global_rank: globalRank,
      total_players: totalPlayers,
      players_above: playersAbove,
      players_below: playersBelow,
      percentile,
    }

    // Segment rank, if the player's city belongs to one: the same definition, among the segment's cities
    if (player.city_id) {
      const segmentCities = await db.query.city_segment_cities.findMany({
        columns: { city_segment_id: true },
        with: { city_segment: { columns: { name: true } } },
        where: eq(city_segment_cities.city_id, player.city_id),
        limit: 1,
      })

      if (segmentCities.length > 0) {
        const segmentId = segmentCities[0].city_segment_id
        const cityRows = await db.query.city_segment_cities.findMany({
          columns: { city_id: true },
          where: eq(city_segment_cities.city_segment_id, segmentId),
        })
        const cityIds = cityRows.map((c) => c.city_id)

        if (cityIds.length > 0) {
          const inSegment = inArray(players.city_id, cityIds)
          position.segment_rank = await rankOf(db, player.elo, inSegment)
          position.segment_total = await rankedCount(db, inSegment)
          position.segment_name = segmentCities[0].city_segment?.name ?? 'Segmento'
        }
      }
    }

    // Tier rank: the same definition, among the ranked players of the player's tier
    const tierInfo = getRatingTier(player.elo)
    const tier = tierInfo.tier
    const inTier = eloBetween(tierInfo.minElo, tierInfo.maxElo)
    position.tier_rank = await rankOf(db, player.elo, inTier)
    position.tier_total = await rankedCount(db, inTier)

    return {
      success: true,
      is_unrated: false,
      position,
      tier,
      current_players: totalPlayers,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
