import { and, count, eq, gte, inArray, isNull, lte, or, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches, players, rating_history, type MatchStatus } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d
}

// scheduled_at in [start,end] OR (scheduled_at is null AND created_at in [start,end])
function scheduledOrCreatedRange(startDate?: string, endDate?: string): SQL {
  const scheduled: SQL[] = []
  const created: SQL[] = []
  if (startDate) {
    scheduled.push(gte(matches.scheduled_at, new Date(startDate)))
    created.push(gte(matches.created_at, new Date(startDate)))
  }
  if (endDate) {
    const end = endOfDay(endDate)
    scheduled.push(lte(matches.scheduled_at, end))
    created.push(lte(matches.created_at, end))
  }
  return or(and(...scheduled), and(isNull(matches.scheduled_at), ...created))!
}

const playerColumns = { id: true, name: true } as const
const categoryColumns = { id: true, name: true, description: true, order: true } as const

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 10
  const offset = parseInt(query.offset as string) || 0
  const status = query.status as string | undefined
  const startDate = query.start_date as string | undefined
  const endDate = query.end_date as string | undefined

  if (!playerId) {
    throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  }

  try {
    const db = useDb()

    const player = UUID.test(playerId)
      ? await db.query.players.findFirst({ columns: { id: true }, where: eq(players.id, playerId) })
      : undefined
    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    const conditions = [or(eq(matches.player1_id, playerId), eq(matches.player2_id, playerId))!]
    if (status) {
      conditions.push(eq(matches.status, status as MatchStatus))
    }
    if (startDate || endDate) {
      if (status === 'completed') {
        if (startDate) conditions.push(gte(matches.played_at, new Date(startDate)))
        if (endDate) conditions.push(lte(matches.played_at, endOfDay(endDate)))
      } else {
        conditions.push(scheduledOrCreatedRange(startDate, endDate))
      }
    }
    const where = and(...conditions)

    const [{ n: totalMatches }] = await db.select({ n: count() }).from(matches).where(where)

    const rawMatches = await db.query.matches.findMany({
      with: {
        player1: { columns: playerColumns, with: { category: { columns: categoryColumns } } },
        player2: { columns: playerColumns, with: { category: { columns: categoryColumns } } },
        pending_player2: {
          columns: { id: true, name: true, email: true, status: true },
          with: { category: { columns: categoryColumns } },
        },
        winner: { columns: { id: true, name: true, status: true } },
        tournament: { columns: { id: true, name: true, category_id: true } },
      },
      where,
      orderBy: (t, { desc }) => desc(t.created_at),
      limit,
      offset,
    })

    // Attach this player's rating-history entry (elo_change, was_winner) for competitive completed matches.
    const competitiveIds = rawMatches.filter((m) => m.is_competitive && m.status === 'completed').map((m) => m.id)
    const historyByMatch = new Map<string, { elo_change: number; was_winner: boolean }>()
    if (competitiveIds.length > 0) {
      const history = await db.query.rating_history.findMany({
        columns: { match_id: true, elo_change: true, was_winner: true },
        where: and(
          eq(rating_history.player_id, playerId),
          inArray(rating_history.match_id, competitiveIds),
          eq(rating_history.rating_reversed, false),
        ),
      })
      for (const h of history) historyByMatch.set(h.match_id, { elo_change: h.elo_change, was_winner: h.was_winner })
    }

    const matchesWithRating = rawMatches.map((match) => {
      const h = historyByMatch.get(match.id)
      return h ? { ...match, elo_change: h.elo_change, was_winner: h.was_winner } : match
    })

    const totalPages = Math.ceil(totalMatches / limit)

    return {
      success: true,
      matches: matchesWithRating,
      pagination: {
        total: totalMatches,
        limit,
        offset,
        total_pages: totalPages,
        current_page: Math.floor(offset / limit) + 1,
        has_next: offset + limit < totalMatches,
        has_previous: offset > 0,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
