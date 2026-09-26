import { and, asc, eq, gte, ilike, inArray, isNull, lte, type SQL } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { tournaments } from '~/server/db/schema'
import { publicPlayer } from '~/server/utils/public-player'

const TOURNAMENT_STATUSES = ['upcoming', 'active', 'completed'] as const

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // Apply filters
    const filters: SQL[] = []

    if (query.status) {
      const status = TOURNAMENT_STATUSES.find((s) => s === query.status)
      if (!status) {
        return [] // No tournament has that status
      }
      filters.push(eq(tournaments.status, status))
    } else {
      // Only show upcoming and active tournaments by default (unless status filter is set)
      filters.push(inArray(tournaments.status, ['upcoming', 'active']))
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

    try {
      return await useDb().query.tournaments.findMany({
        where: and(...filters),
        orderBy: [asc(tournaments.start_date)],
        with: {
          category: true,
          created_by_player: publicPlayer,
          organizer: publicPlayer,
          registrations: { with: { player: publicPlayer } },
        },
      })
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournaments',
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
