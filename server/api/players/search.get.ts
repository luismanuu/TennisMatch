import { and, asc, eq, ilike, ne } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const searchTerm = ((query.q as string) || '').trim()
    const excludePlayerId = query.exclude_player_id as string | undefined

    if (searchTerm.length < 2) {
      return []
    }

    const conditions = [ilike(players.name, `%${searchTerm}%`), eq(players.status, 'active')]
    if (excludePlayerId && UUID.test(excludePlayerId)) {
      conditions.push(ne(players.id, excludePlayerId))
    }

    return await useDb().query.players.findMany({
      columns: {
        id: true,
        name: true,
        elo: true,
        total_matches_played: true,
        placement_matches_completed: true,
      },
      with: {
        category: { columns: { id: true, name: true, description: true, order: true } },
      },
      where: and(...conditions),
      orderBy: asc(players.name),
      limit: 20,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
