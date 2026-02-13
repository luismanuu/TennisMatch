import { checkIsAdmin } from '~/server/utils/admin'
import { clerkIdQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id

    const isAdmin = await checkIsAdmin(clerkId)

    return {
      isAdmin,
      clerkId
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/check')
  }
})
