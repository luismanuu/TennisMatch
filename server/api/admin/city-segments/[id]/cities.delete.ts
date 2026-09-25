import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import type { RemoveCityFromSegmentPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const segmentId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const cityId = query.city_id as RemoveCityFromSegmentPayload['city_id'] | undefined

    if (!segmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Segment ID is required' })
    }
    if (!cityId) {
      throw createError({ statusCode: 400, statusMessage: 'city_id is required' })
    }

    const db = useDb()

    if (UUID.test(segmentId) && UUID.test(cityId)) {
      await db
        .delete(city_segment_cities)
        .where(and(eq(city_segment_cities.city_segment_id, segmentId), eq(city_segment_cities.city_id, cityId)))
    }

    const updatedSegment = UUID.test(segmentId)
      ? await db.query.city_segments.findFirst({
          with: { city_segment_cities: { with: { city: { columns: { id: true, name: true, order: true } } } } },
          where: eq(city_segments.id, segmentId),
        })
      : undefined

    if (!updatedSegment) {
      return { success: true, message: 'City removed from segment successfully' }
    }

    return {
      success: true,
      segment: {
        id: updatedSegment.id,
        name: updatedSegment.name,
        description: updatedSegment.description,
        created_at: updatedSegment.created_at,
        updated_at: updatedSegment.updated_at,
        cities: updatedSegment.city_segment_cities
          .map((csc) => csc.city)
          .filter((c): c is { id: string; name: string; order: number } => Boolean(c))
          .sort((a, b) => a.order - b.order),
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
