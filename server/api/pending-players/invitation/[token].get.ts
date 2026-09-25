import { and, eq } from 'drizzle-orm'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

// Public: the token in the link is the only credential. Anything but a pending invitation is a 404.
export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')

    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation token is required'
      })
    }

    const pendingPlayer = await useDb().query.pending_players.findFirst({
      columns: {
        id: true,
        name: true,
        email: true,
        category_id: true,
        invited_by_player_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
      with: {
        category: { columns: { id: true, name: true, description: true, order: true } },
        invited_by_player: { columns: { id: true, name: true } },
      },
      where: and(eq(pending_players.invitation_token, token), eq(pending_players.status, 'pending')),
    })

    if (!pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found or invalid'
      })
    }

    // Organizer invitations no longer exist; every invitation is for a player.
    return { ...pendingPlayer, role: 'player' as const }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
