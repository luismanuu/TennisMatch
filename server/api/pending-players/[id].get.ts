import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  try {
    const pendingPlayerId = getRouterParam(event, 'id')

    if (!pendingPlayerId) {
      throw createError({ statusCode: 400, statusMessage: 'Pending Player ID is required' })
    }

    // Public profile: name, category, status only. The email is personal data and never leaves the server here.
    // Do NOT return: invitation_token
    const pendingPlayer = UUID.test(pendingPlayerId)
      ? await useDb().query.pending_players.findFirst({
          columns: { id: true, name: true, category_id: true, status: true, created_at: true },
          with: { category: true },
          where: eq(pending_players.id, pendingPlayerId),
        })
      : undefined

    if (!pendingPlayer) {
      throw createError({ statusCode: 404, statusMessage: 'Pending player not found' })
    }

    return pendingPlayer
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error',
    })
  }
})
