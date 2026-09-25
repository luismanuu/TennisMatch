import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{ category_orders: Array<{ id: string; order: number }> }>(event)
    const { category_orders } = body

    if (!category_orders || !Array.isArray(category_orders) || category_orders.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'category_orders array is required' })
    }

    // All-or-nothing: a partial reorder would leave the list in an inconsistent order.
    await useDb().transaction(async (tx) => {
      for (const { id, order } of category_orders) {
        await tx.update(categories).set({ order }).where(eq(categories.id, id))
      }
    })

    return {
      success: true,
      message: 'Categories reordered successfully',
      updated: category_orders.length,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
