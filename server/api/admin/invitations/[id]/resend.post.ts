import { eq } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/session'
import { invitationUrl, newInvitationToken, sendInvitationEmail } from '~/server/utils/invitations'
import { useDb } from '~/server/db'
import { pending_players } from '~/server/db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resending rotates the token, so any earlier link stops working.
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

    if (invitation.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot resend invitation - invitation status is ${invitation.status}`
      })
    }

    const token = newInvitationToken()
    await db
      .update(pending_players)
      .set({ invitation_token: token, updated_at: new Date() })
      .where(eq(pending_players.id, invitation.id))

    const url = invitationUrl(event, token)
    const emailSent = await sendInvitationEmail({ to: invitation.email, name: invitation.name, url })

    return {
      success: true,
      message: emailSent
        ? 'Invitation email resent successfully'
        : 'Invitation link regenerated. Email is not configured; share the link manually.',
      invitation_id: invitation.id,
      invitation_status: invitation.status,
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
