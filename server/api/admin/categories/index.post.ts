import { desc, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{
      name: string
      description?: string
      order?: number
      default_elo?: number
    }>(event)

    const { name, description, order, default_elo } = body

    if (!name || name.trim().length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Category name is required' })
    }

    const db = useDb()

    const existingCategory = await db.query.categories.findFirst({
      columns: { id: true },
      where: eq(categories.name, name.trim()),
    })
    if (existingCategory) {
      throw createError({ statusCode: 400, statusMessage: 'Category with this name already exists' })
    }

    let categoryOrder = order
    if (categoryOrder === undefined || categoryOrder === null) {
      const maxOrderResult = await db.query.categories.findFirst({
        columns: { order: true },
        orderBy: desc(categories.order),
      })
      categoryOrder = maxOrderResult ? maxOrderResult.order + 1 : 0
    }

    // Formula: 2500 - ((order - 1) * 250) for categories 1-7
    const defaultEloValue = default_elo !== undefined ? default_elo : Math.max(1000, 2500 - (categoryOrder - 1) * 250)

    const [category] = await db
      .insert(categories)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        order: categoryOrder,
        default_elo: defaultEloValue,
      })
      .returning()

    return {
      success: true,
      message: 'Category created successfully',
      category,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
