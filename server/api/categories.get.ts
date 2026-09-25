import { asc } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories } from '~/server/db/schema'

export default defineEventHandler(async () => {
  try {
    return await useDb().query.categories.findMany({ orderBy: asc(categories.order) })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
