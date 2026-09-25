import { and, desc, eq, ilike, isNull, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // Completed tournaments only
    const filters: SQL[] = [eq(tournaments.status, 'completed')]

    // Apply optional filters
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

    if (query.search) {
      filters.push(ilike(tournaments.name, `%${query.search}%`))
    }

    try {
      return await useDb().query.tournaments.findMany({
        where: and(...filters),
        orderBy: [desc(tournaments.end_date)],
        with: {
          category: true,
          created_by_player: true,
          organizer: true,
          registrations: { with: { player: true } },
        },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch past tournaments',
        data: error
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
