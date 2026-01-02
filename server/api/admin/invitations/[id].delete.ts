import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient, getAllClerkInvitations } from '~/server/utils/clerk'

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
      const invitation = invitations.find((inv: any) => inv.id === invitationId)
      if (invitation) {
        invitationEmail = invitation.emailAddress || ''
        const metadata = (invitation.publicMetadata as any) || {}
        invitationName = metadata.name || invitationEmail
      }
    } catch (e) {
      console.warn('Could not fetch invitation details before deletion:', e)
    }

    // Revoke/delete the invitation in Clerk
    try {
      await client.invitations.revokeInvitation(invitationId)
      console.log('Revoked Clerk invitation:', invitationId)
    } catch (deleteError: any) {
      console.error('Error revoking Clerk invitation:', deleteError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to delete invitation: ${deleteError?.message || 'Unknown error'}`,
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
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

