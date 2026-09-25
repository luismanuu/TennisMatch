import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { players } from '~/server/db/schema'
import { requireUser } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const player = await useDb().query.players.findFirst({
      where: and(eq(players.user_id, user.id), eq(players.status, 'active')),
      with: {
        category: true,
        city: true,
      },
    })

    if (!player) {
      throw createError({ statusCode: 404, statusMessage: 'Player profile not found' })
    }

    return player
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
    })
  }
})
