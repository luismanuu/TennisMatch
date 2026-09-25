import { and, eq, ne } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const categoryId = getRouterParam(event, 'id')
    const body = await readBody<{
      name?: string
      description?: string
      order?: number
      default_elo?: number
    }>(event)

    const { name, description, order, default_elo } = body

    if (!categoryId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: category_id' })
    }

    const db = useDb()

    const existingCategory = UUID.test(categoryId)
      ? await db.query.categories.findFirst({ columns: { id: true, name: true }, where: eq(categories.id, categoryId) })
      : undefined

    if (!existingCategory) {
      throw createError({ statusCode: 404, statusMessage: 'Category not found' })
    }

    if (name && name.trim() !== existingCategory.name) {
      const nameConflict = await db.query.categories.findFirst({
        columns: { id: true },
        where: and(eq(categories.name, name.trim()), ne(categories.id, categoryId)),
      })
      if (nameConflict) {
        throw createError({ statusCode: 400, statusMessage: 'Category with this name already exists' })
      }
    }

    const updateData: Partial<typeof categories.$inferInsert> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (order !== undefined) updateData.order = order
    if (default_elo !== undefined) updateData.default_elo = default_elo

    const [category] = await db.update(categories).set(updateData).where(eq(categories.id, categoryId)).returning()

    return {
      success: true,
      message: 'Category updated successfully',
      category,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
