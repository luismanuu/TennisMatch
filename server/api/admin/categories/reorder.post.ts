import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{
      category_orders: Array<{ id: string; order: number }>
    }>(event)

    const { category_orders } = body

    if (!category_orders || !Array.isArray(category_orders) || category_orders.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'category_orders array is required'
      })
    }

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
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})




