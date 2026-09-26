import { and, count, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { orderedBefore, rankedPlayers, rankedRows } from '~/server/utils/ranking'
import type { NearbyPlayersResponse } from '~/types/leaderboard'

// The ranked players just above and below one player, with their global rank (server/utils/ranking.ts)
export default defineEventHandler(async (event): Promise<NearbyPlayersResponse> => {
  try {
    const query = getQuery(event)
    const playerId = query.player_id as string
    const range = Math.max(1, Math.min(query.range ? parseInt(query.range as string) || 5 : 5, 10))

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'player_id is required',
      })
    }

    const db = useDb()
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const [target] = UUID.test(playerId)
      ? await db.select({ id: players.id, elo: players.elo }).from(players).where(and(rankedPlayers, eq(players.id, playerId)))
      : []
    if (!target) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found in rankings',
      })
    }

    const [{ n: index }] = await db.select({ n: count() }).from(players).where(and(rankedPlayers, orderedBefore(target.elo, target.id)))
    const start = Math.max(0, index - range)
    const rows = await rankedRows(db, { limit: index - start + 1 + range, offset: start, viewerId: playerId })
    const at = rows.findIndex((p) => p.id === playerId)
    if (at < 0) {
      throw createError({ statusCode: 409, statusMessage: 'The ranking changed while it was read; try again' })
    }

    return {
      success: true,
      current_player: rows[at],
      players_above: rows.slice(0, at),
      players_below: rows.slice(at + 1),
    }
  } catch (error: any) {
    console.error('Nearby players error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
