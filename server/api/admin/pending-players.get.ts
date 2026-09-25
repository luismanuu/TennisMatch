import { requireAdmin } from '~/server/utils/session'
import { useDb } from '~/server/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    return await useDb().query.pending_players.findMany({
      with: {
        category: { columns: { id: true, name: true, description: true, order: true } },
        invited_by_player: { columns: { id: true, name: true } },
      },
      orderBy: (t, { desc }) => desc(t.created_at),
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
