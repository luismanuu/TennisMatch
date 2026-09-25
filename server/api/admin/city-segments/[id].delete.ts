import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { city_segments } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const segmentId = getRouterParam(event, 'id')

    if (!segmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Segment ID is required' })
    }

    // Delete cascades to city_segment_cities.
    if (UUID.test(segmentId)) {
      await useDb().delete(city_segments).where(eq(city_segments.id, segmentId))
    }

    return { success: true, message: 'City segment deleted successfully' }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
