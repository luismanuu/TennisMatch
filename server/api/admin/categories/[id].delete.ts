import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const categoryId = getRouterParam(event, 'id')

    if (!categoryId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: category_id' })
    }

    const db = useDb()

    const category = UUID.test(categoryId)
      ? await db.query.categories.findFirst({ columns: { id: true, name: true }, where: eq(categories.id, categoryId) })
      : undefined

    if (!category) {
      throw createError({ statusCode: 404, statusMessage: 'Category not found' })
    }

    const playerUsingCategory = await db.query.players.findFirst({
      columns: { id: true },
      where: and(eq(players.category_id, categoryId), eq(players.status, 'active')),
    })

    if (playerUsingCategory) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot delete category: There are active players using this category' })
    }

    await db.delete(categories).where(eq(categories.id, categoryId))

    return {
      success: true,
      message: `Category "${category.name}" has been deleted successfully`,
      deletedCategory: { id: category.id, name: category.name },
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
