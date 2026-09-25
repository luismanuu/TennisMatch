import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { categories, players } from '~/server/db/schema'
import { requireAdmin } from '~/server/utils/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const playerId = getRouterParam(event, 'id')
    const body = await readBody<{
      name?: string
      phone_number?: string
      category_id?: string
      elo?: number
    }>(event)

    const { name, phone_number, category_id, elo } = body

    if (!playerId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: player_id' })
    }

    const db = useDb()

    const player = UUID.test(playerId)
      ? await db.query.players.findFirst({ columns: { id: true, name: true }, where: eq(players.id, playerId) })
      : undefined

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }

    const updateData: Partial<typeof players.$inferInsert> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone_number !== undefined) updateData.phone_number = phone_number?.trim() || null
    if (category_id !== undefined) updateData.category_id = category_id || null
    if (elo !== undefined) {
      const eloNum = Number(elo)
      if (isNaN(eloNum) || eloNum < 0) {
        throw createError({ statusCode: 400, statusMessage: 'ELO must be a positive number' })
      }
      updateData.elo = eloNum
    }

    if (category_id) {
      const category = UUID.test(category_id)
        ? await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, category_id) })
        : undefined
      if (!category) {
        throw createError({ statusCode: 400, statusMessage: 'Category not found' })
      }
    }

    await db.update(players).set(updateData).where(eq(players.id, playerId))

    const updatedPlayer = await db.query.players.findFirst({
      columns: {
        id: true,
        user_id: true,
        name: true,
        phone_number: true,
        category_id: true,
        elo: true,
        status: true,
        deleted_at: true,
        created_at: true,
        updated_at: true,
      },
      with: { category: { columns: { id: true, name: true, description: true, order: true } } },
      where: eq(players.id, playerId),
    })

    return {
      success: true,
      message: 'Player updated successfully',
      player: updatedPlayer,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
