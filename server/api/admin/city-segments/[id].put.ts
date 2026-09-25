import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'
import type { UpdateCitySegmentPayload } from '~/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const segmentId = getRouterParam(event, 'id')

    if (!segmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Segment ID is required' })
    }

    const body = await readBody<UpdateCitySegmentPayload>(event)
    const { name, description } = body

    const updateData: Partial<typeof city_segments.$inferInsert> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null

    if (Object.keys(updateData).length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No update data provided' })
    }

    if (!UUID.test(segmentId)) {
      throw createError({ statusCode: 404, statusMessage: 'City segment not found' })
    }

    const db = useDb()

    let updated
    try {
      ;[updated] = await db.update(city_segments).set(updateData).where(eq(city_segments.id, segmentId)).returning()
    } catch (error: any) {
      if (error?.code === '23505') {
        throw createError({ statusCode: 400, statusMessage: 'A city segment with this name already exists' })
      }
      throw createError({ statusCode: 500, statusMessage: 'Failed to update city segment' })
    }

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'City segment not found' })
    }

    const segment = await db.query.city_segments.findFirst({
      with: { city_segment_cities: { with: { city: { columns: { id: true, name: true, order: true } } } } },
      where: eq(city_segments.id, segmentId),
    })

    return {
      success: true,
      segment: {
        id: segment!.id,
        name: segment!.name,
        description: segment!.description,
        created_at: segment!.created_at,
        updated_at: segment!.updated_at,
        cities: segment!.city_segment_cities
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
