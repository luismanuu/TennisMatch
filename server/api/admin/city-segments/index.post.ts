import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segment_cities, city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import type { CreateCitySegmentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<CreateCitySegmentPayload>(event)
    const { name, description, city_ids } = body

    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'name is required' })
    }

    const db = useDb()

    let segment
    try {
      ;[segment] = await db
        .insert(city_segments)
        .values({ name, description: description || null })
        .returning()
    } catch (error: any) {
      if (error?.code === '23505') {
        throw createError({ statusCode: 400, statusMessage: 'A city segment with this name already exists' })
      }
      throw createError({ statusCode: 500, statusMessage: 'Failed to create city segment' })
    }

    if (city_ids && city_ids.length > 0) {
      try {
        await db.insert(city_segment_cities).values(city_ids.map((cityId) => ({ city_segment_id: segment.id, city_id: cityId })))
      } catch (error) {
        console.error('Error adding cities to segment:', error)
        // Don't fail the request, segment was created successfully
      }
    }

    const completeSegment = await db.query.city_segments.findFirst({
      with: { city_segment_cities: { with: { city: { columns: { id: true, name: true, order: true } } } } },
      where: eq(city_segments.id, segment.id),
    })

    if (!completeSegment) {
      return { success: true, segment }
    }

    return {
      success: true,
      segment: {
        id: completeSegment.id,
        name: completeSegment.name,
        description: completeSegment.description,
        created_at: completeSegment.created_at,
        updated_at: completeSegment.updated_at,
        cities: completeSegment.city_segment_cities
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
