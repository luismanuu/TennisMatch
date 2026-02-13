import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      category_orders: Array<{ id: string; order: number }>
    }>(event)

    const { clerk_id, category_orders } = body

    if (!clerk_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!category_orders || !Array.isArray(category_orders) || category_orders.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'category_orders array is required'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Update each category's order
    const updatePromises = category_orders.map(({ id, order }) =>
      supabase
        .from('categories')
        .update({ order })
        .eq('id', id)
    )

    const results = await Promise.all(updatePromises)

    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to reorder some categories',
        data: errors
      })
    }

    return {
      success: true,
      message: 'Categories reordered successfully',
      updated: category_orders.length
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/admin/categories/reorder')
  }
})




