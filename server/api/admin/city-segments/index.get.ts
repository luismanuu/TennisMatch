import { asc, count } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

function transformSegment(segment: {
  id: string
  name: string
  description: string | null
  created_at: Date | null
  updated_at: Date | null
  city_segment_cities: Array<{ city: { id: string; name: string; order: number } | null }>
}) {
  return {
    id: segment.id,
    name: segment.name,
    description: segment.description,
    created_at: segment.created_at,
    updated_at: segment.updated_at,
    cities: segment.city_segment_cities
      .map((csc) => csc.city)
      .filter((c): c is { id: string; name: string; order: number } => Boolean(c))
      .sort((a, b) => a.order - b.order),
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const limit = Math.min(query.limit ? parseInt(query.limit as string) : 50, 500)
    const offset = query.offset ? parseInt(query.offset as string) : 0

    const db = useDb()

    const [{ n: total }] = await db.select({ n: count() }).from(city_segments)

    const segments = await db.query.city_segments.findMany({
      with: {
        city_segment_cities: { with: { city: { columns: { id: true, name: true, order: true } } } },
      },
      orderBy: asc(city_segments.name),
      limit,
      offset,
    })

    return {
      success: true,
      segments: segments.map(transformSegment),
      total,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
