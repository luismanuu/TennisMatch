import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminCategoriesListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { CATEGORY_SELECT_FULL } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminCategoriesListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 500
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_FULL)
      .order('order', { ascending: true })
      .range(offset, offset + limit - 1)

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch categories',
        data: fetchError
      })
    }

    return categories || []
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/categories/index')
  }
})




