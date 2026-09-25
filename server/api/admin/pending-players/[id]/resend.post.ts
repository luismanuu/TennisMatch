import { eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { invitationUrl, newInvitationToken, sendInvitationEmail } from '~/server/utils/invitations'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Same behaviour as admin/invitations/[id]/resend: rotate the token and email the new link.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const pendingPlayerId = getRouterParam(event, 'id')

    if (!pendingPlayerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: pending_player_id'
      })
    }

    const db = useDb()
    const pendingPlayer = UUID.test(pendingPlayerId)
      ? await db.query.pending_players.findFirst({
          columns: { id: true, name: true, email: true, status: true },
          where: eq(pending_players.id, pendingPlayerId),
        })
      : undefined

    if (!pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }

    // Only allow resending for pending invitations
    if (pendingPlayer.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot resend invitation - invitation status is ${pendingPlayer.status}`
      })
    }

    const token = newInvitationToken()
    await db
      .update(pending_players)
      .set({ invitation_token: token, updated_at: new Date() })
      .where(eq(pending_players.id, pendingPlayer.id))

    const url = invitationUrl(token)
    const emailSent = await sendInvitationEmail({ to: pendingPlayer.email, name: pendingPlayer.name, url })

    return {
      success: true,
      message: emailSent
        ? 'Invitation email resent successfully'
        : 'Invitation link regenerated. Email is not configured; share the link manually.',
      invitation_id: pendingPlayer.id,
      invitation_status: pendingPlayer.status,
      invitation_url: url,
      email_sent: emailSent
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
