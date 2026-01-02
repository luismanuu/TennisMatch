import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient, revokePendingInvitationsByEmail, getAllClerkInvitations } from '~/server/utils/clerk'

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
    const config = useRuntimeConfig()
    const baseUrl = config.public?.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Get the invitation from Clerk by fetching all invitations and finding it by ID
    // Clerk SDK doesn't have getInvitation, so we use getAllClerkInvitations
    let invitation
    try {
      const { invitations } = await getAllClerkInvitations()
      invitation = invitations.find((inv: any) => inv.id === invitationId)
    } catch (getError: any) {
      console.error('Error fetching invitation from Clerk:', getError)
      throw createError({
        statusCode: 404,
        statusMessage: `Invitation not found in Clerk: ${getError?.message || 'Unknown error'}`,
        data: getError
      })
    }
    
    if (!invitation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found in Clerk'
      })
    }

    if (invitation.revoked) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot resend revoked invitation'
      })
    }

    const metadata = (invitation.publicMetadata as any) || {}
    const email = invitation.emailAddress
    const name = metadata.name || email?.split('@')[0] || 'Unknown'
    const invitationToken = metadata.invitationToken || ''
    
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation is missing email address'
      })
    }

    const invitationUrl = invitationToken ? `${baseUrl}/invitation/${invitationToken}` : undefined

    // Resend the invitation via Clerk
    // Note: Clerk doesn't have a direct "resend" API, so we revoke and create a new one
    try {
      // First, revoke any existing pending invitations for this email (including the current one)
      // This prevents "invitation already exists" errors
      await revokePendingInvitationsByEmail(email)
      
      // Also explicitly revoke the current invitation if it's not already revoked
      if (!invitation.revoked) {
        try {
          await client.invitations.revokeInvitation(invitationId)
        } catch (revokeError: any) {
          // If it's already revoked or doesn't exist, that's okay
          console.warn('Could not revoke invitation (may already be revoked):', revokeError?.message)
        }
      }
      
      // Create a new invitation with the same data
      const newInvitationPayload: any = {
        emailAddress: email,
        publicMetadata: {
          ...metadata,
          name: name,
          invitationToken: invitationToken
        }
      }
      
      if (invitationUrl) {
        newInvitationPayload.redirectUrl = invitationUrl
      }

      const newInvitation = await client.invitations.createInvitation(newInvitationPayload)

      console.log('Invitation resent successfully:', {
        oldId: invitationId,
        newId: newInvitation.id,
        email: email
      })

      return {
        success: true,
        message: 'Invitation email resent successfully',
        invitation_id: newInvitation.id,
        invitation_status: newInvitation.status
      }
    } catch (resendError: any) {
      console.error('Error resending invitation:', {
        message: resendError?.message,
        statusCode: resendError?.statusCode,
        status: resendError?.status,
        errors: resendError?.errors,
        clerkError: resendError?.clerkError
      })
      
      // Extract more specific error message
      let errorMessage = resendError?.message || 'Unknown error'
      if (resendError?.errors && Array.isArray(resendError.errors) && resendError.errors.length > 0) {
        const firstError = resendError.errors[0]
        errorMessage = firstError?.longMessage || firstError?.message || errorMessage
      }
      
      throw createError({
        statusCode: resendError?.statusCode || resendError?.status || 500,
        statusMessage: `Failed to resend invitation: ${errorMessage}`,
        data: resendError
      })
    }
  } catch (error: any) {
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    console.error('Unexpected error in resend invitation endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error
    })
  }
})

