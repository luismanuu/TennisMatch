import { and, count, desc, eq, gte, ilike, isNull, lte, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const TOURNAMENT_STATUSES = ['upcoming', 'active', 'completed'] as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)

    // Pagination parameters
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0
    const empty = { data: [], total: 0, page: Math.floor(offset / limit) + 1, page_size: limit }

    // The same filters apply to the rows and to the count
    const filters: SQL[] = []

    if (query.status) {
      const status = TOURNAMENT_STATUSES.find((s) => s === query.status)
      if (!status) {
        return empty // No tournament has that status
      }
      filters.push(eq(tournaments.status, status))
    }

    if (query.category_id !== undefined) {
      if (query.category_id === null || query.category_id === 'null') {
        // Filter for tournaments without category (open to all)
        filters.push(isNull(tournaments.category_id))
      } else {
        filters.push(eq(tournaments.category_id, String(query.category_id)))
      }
    }

    if (query.organizer_id) {
      filters.push(eq(tournaments.organizer_id, String(query.organizer_id)))
    }

    if (query.start_date_from) {
      filters.push(gte(tournaments.start_date, new Date(String(query.start_date_from))))
    }

    if (query.start_date_to) {
      filters.push(lte(tournaments.start_date, new Date(String(query.start_date_to))))
    }

    if (query.search) {
      filters.push(ilike(tournaments.name, `%${query.search}%`))
    }

    const db = useDb()
    const where = and(...filters)

    // Get total count
    let total: number
    try {
      const [{ n }] = await db.select({ n: count() }).from(tournaments).where(where)
      total = n
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count tournaments',
        data: error
      })
    }

    // Apply pagination
    let rows
    try {
      rows = await db.query.tournaments.findMany({
        where,
        orderBy: [desc(tournaments.created_at)],
        limit,
        offset,
        with: { category: true, created_by_player: true, organizer: true },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
        data: error
      })
    }

    return {
      data: rows,
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
