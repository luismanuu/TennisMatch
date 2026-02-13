import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient, getAllClerkInvitations } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const r = asRecord(obj)
  const v = r ? r[key] : undefined
  return typeof v === 'string' ? v : undefined
}

export default defineEventHandler(async (event) => {
  try {
    const invitationId = getRouterParam(event, 'id')
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body

    if (!invitationId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: invitation_id, clerk_id'
      })
    }

    await requireAdmin(clerk_id)

    const client = getClerkClient()

    // Get invitation details before deleting
    // Clerk SDK doesn't have getInvitation, so we use getAllClerkInvitations
    let invitationEmail = ''
    let invitationName = ''
    try {
      const { invitations } = await getAllClerkInvitations()
      const typedInvitations = invitations as unknown as Array<{ id: string; emailAddress?: string | null; publicMetadata?: unknown }>
      const invitation = typedInvitations.find((inv) => inv.id === invitationId)
      if (invitation) {
        invitationEmail = invitation.emailAddress || ''
        const invitationNameFromMeta = getStringProp(invitation.publicMetadata, 'name')
        invitationName = invitationNameFromMeta || invitationEmail
      }
    } catch (e) {
      logger.warn('Could not fetch invitation details before deletion', { error: e, invitationId })
    }

    // Revoke/delete the invitation in Clerk
    try {
      await client.invitations.revokeInvitation(invitationId)
      logger.info('Revoked Clerk invitation', { invitationId })
    } catch (deleteError: unknown) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unknown error'
      logger.error('Error revoking Clerk invitation', deleteError, { invitationId })
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to delete invitation: ${message}`,
        data: deleteError
      })
    }

    return {
      success: true,
      message: `Invitation for "${invitationName}" (${invitationEmail}) has been deleted successfully`,
      deletedInvitation: {
        id: invitationId,
        name: invitationName,
        email: invitationEmail
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'DELETE /api/admin/invitations/[id]')
  }
})

