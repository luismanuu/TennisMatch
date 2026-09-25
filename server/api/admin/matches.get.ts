import { and, count, desc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { matches } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const categoryColumns = { columns: { id: true, name: true, description: true, order: true } } as const
const listedPlayer = { columns: { id: true, name: true, status: true }, with: { category: categoryColumns } } as const
const namedPlayer = { columns: { id: true, name: true } } as const

// Ecuador is UTC-5 with no daylight saving. A bare YYYY-MM-DD start means 00:00 that day in Ecuador;
// the conversion below keeps the arithmetic the admin page has always used (day - 1 at 05:00 UTC).
function startOfEcuadorDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0, 0))
  }
  return new Date(value)
}

// A bare YYYY-MM-DD end includes the whole Ecuador day: 05:00 UTC on the next day
function endOfEcuadorDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0))
  }
  return new Date(value)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const status = query.status as string | undefined
    const playerId = query.player_id as string | undefined
    const startDate = query.start_date as string | undefined
    const endDate = query.end_date as string | undefined
    
    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()

    const conditions: Array<SQL | undefined> = []
    if (status) {
      conditions.push(eq(matches.status, status as typeof matches.$inferSelect.status))
    }
    if (playerId) {
      conditions.push(or(eq(matches.player1_id, playerId), eq(matches.player2_id, playerId)))
    }

    if (startDate || endDate) {
      const start = startDate ? startOfEcuadorDay(startDate) : undefined
      const end = endDate ? endOfEcuadorDay(endDate) : undefined

      if (status === 'scheduled') {
        // Scheduled matches without scheduled_at are always shown
        if (start && end) {
          conditions.push(or(and(gte(matches.scheduled_at, start), lte(matches.scheduled_at, end)), isNull(matches.scheduled_at)))
        } else if (start) {
          conditions.push(or(gte(matches.scheduled_at, start), isNull(matches.scheduled_at)))
        } else if (end) {
          conditions.push(or(lte(matches.scheduled_at, end), isNull(matches.scheduled_at)))
        }
      } else {
        if (start) conditions.push(gte(matches.scheduled_at, start))
        if (end) conditions.push(lte(matches.scheduled_at, end))
      }
    }

    const where = and(...conditions)

    const [{ total }] = await db.select({ total: count() }).from(matches).where(where)

    // scheduled_at descending (nulls last), then created_at descending
    const rows = await db.query.matches.findMany({
      where,
      with: {
        player1: listedPlayer,
        player2: listedPlayer,
        pending_player2: {
          columns: { id: true, name: true, email: true, status: true },
          with: { category: categoryColumns },
        },
        winner: { columns: { id: true, name: true, status: true } },
        score_proposed_by_player: namedPlayer,
        score_approved_by_player: namedPlayer,
        reschedule_proposed_by_player: namedPlayer,
        reschedule_approved_by_player: namedPlayer,
        reschedule_rejected_by_player: namedPlayer,
      },
      orderBy: [sql`${matches.scheduled_at} desc nulls last`, desc(matches.created_at)],
      limit,
      offset,
    })

    // The page only ever received the *_by_player keys whose id was set
    const enrichedMatches = rows.map((row) => {
      const {
        score_proposed_by_player,
        score_approved_by_player,
        reschedule_proposed_by_player,
        reschedule_approved_by_player,
        reschedule_rejected_by_player,
        ...match
      } = row
      return {
        ...match,
        ...(match.score_proposed_by ? { score_proposed_by_player } : {}),
        ...(match.score_approved_by ? { score_approved_by_player } : {}),
        ...(match.reschedule_proposed_by ? { reschedule_proposed_by_player } : {}),
        ...(match.reschedule_approved_by ? { reschedule_approved_by_player } : {}),
        ...(match.reschedule_rejected_by ? { reschedule_rejected_by_player } : {}),
      }
    })

    return {
      data: enrichedMatches,
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})
