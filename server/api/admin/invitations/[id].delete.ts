import { eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Revoking an invitation expires the pending player instead of deleting it: matches may reference the row.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const invitationId = getRouterParam(event, 'id')

    if (!invitationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: invitation_id'
      })
    }

    const db = useDb()
    const invitation = UUID.test(invitationId)
      ? await db.query.pending_players.findFirst({
          columns: { id: true, name: true, email: true, status: true },
          where: eq(pending_players.id, invitationId),
        })
      : undefined

    if (!invitation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found'
      })
    }

    if (invitation.status === 'accepted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation has already been accepted'
      })
    }

    // Clearing the token kills the link even if a caller forgets to check the status.
    await db
      .update(pending_players)
      .set({ status: 'expired', invitation_token: null, updated_at: new Date() })
      .where(eq(pending_players.id, invitationId))

    return {
      success: true,
      message: 'Invitation revoked successfully',
      deletedInvitation: {
        id: invitation.id,
        name: invitation.name,
        email: invitation.email
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
