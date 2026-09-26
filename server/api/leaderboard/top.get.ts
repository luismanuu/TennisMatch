import { useDb } from '~/server/db'
import { rankedRows } from '~/server/utils/ranking'

// The top ranked players with their global rank (server/utils/ranking.ts)
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = Math.max(1, Math.min(query.limit ? parseInt(query.limit as string) || 10 : 10, 50))
    const topPlayers = await rankedRows(useDb(), { limit })
    return {
      success: true,
      top_players: topPlayers,
      total: topPlayers.length,
    }
  } catch (error: any) {
    console.error('Top players error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
