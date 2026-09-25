import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import type { AddCitiesToSegmentPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const segmentId = getRouterParam(event, 'id')

    if (!segmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Segment ID is required' })
    }

    const body = await readBody<AddCitiesToSegmentPayload>(event)
    const { city_ids } = body

    if (!city_ids || city_ids.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'city_ids is required and must not be empty' })
    }

    const db = useDb()

    const segment = UUID.test(segmentId)
      ? await db.query.city_segments.findFirst({ columns: { id: true }, where: eq(city_segments.id, segmentId) })
      : undefined

    if (!segment) {
      throw createError({ statusCode: 404, statusMessage: 'City segment not found' })
    }

    try {
      await db
        .insert(city_segment_cities)
        .values(city_ids.map((cityId) => ({ city_segment_id: segmentId, city_id: cityId })))
        .onConflictDoNothing({ target: [city_segment_cities.city_segment_id, city_segment_cities.city_id] })
    } catch (error) {
      console.error('Error adding cities to segment:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to add cities to segment' })
    }

    const updatedSegment = await db.query.city_segments.findFirst({
      with: { city_segment_cities: { with: { city: { columns: { id: true, name: true, order: true } } } } },
      where: eq(city_segments.id, segmentId),
    })

    if (!updatedSegment) {
      return { success: true, message: 'Cities added successfully' }
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
