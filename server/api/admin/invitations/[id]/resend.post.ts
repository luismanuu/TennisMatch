import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient, revokePendingInvitationsByEmail, getAllClerkInvitations } from '~/server/utils/clerk'
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
    const config = useRuntimeConfig()
    const baseUrl = config.public?.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Get the invitation from Clerk by fetching all invitations and finding it by ID
    // Clerk SDK doesn't have getInvitation, so we use getAllClerkInvitations
    let invitation
    try {
      const { invitations } = await getAllClerkInvitations()
      const typedInvitations = invitations as unknown as Array<{
        id: string
        emailAddress?: string | null
        revoked?: boolean
        status?: string | null
        publicMetadata?: unknown
      }>
      invitation = typedInvitations.find((inv) => inv.id === invitationId)
    } catch (getError: unknown) {
      logger.error('Error fetching invitation from Clerk', getError, { invitationId })
      const message = getError instanceof Error ? getError.message : 'Unknown error'
      throw createError({
        statusCode: 404,
        statusMessage: `Invitation not found in Clerk: ${message}`,
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

    const metadata = (asRecord(invitation.publicMetadata) ?? {}) as Record<string, unknown>
    const email = invitation.emailAddress
    const name = (getStringProp(metadata, 'name') || email?.split('@')[0] || 'Unknown') as string
    const invitationToken = getStringProp(metadata, 'invitationToken') || ''
    
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
        } catch (revokeError: unknown) {
          // If it's already revoked or doesn't exist, that's okay
          const message = revokeError instanceof Error ? revokeError.message : 'Unknown error'
          logger.warn('Could not revoke invitation (may already be revoked)', { 
            error: message, 
            invitationId 
          })
        }
      }
      
      // Create a new invitation with the same data
      const newInvitationPayload = {
        emailAddress: email,
        publicMetadata: {
          ...metadata,
          name: name,
          invitationToken: invitationToken
        }
      }
      
      if (invitationUrl) {
        ;(newInvitationPayload as { redirectUrl?: string }).redirectUrl = invitationUrl
      }

      const newInvitation = await client.invitations.createInvitation(
        newInvitationPayload as Parameters<typeof client.invitations.createInvitation>[0]
      )

      logger.info('Invitation resent successfully', {
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
    } catch (resendError: unknown) {
      const err = typeof resendError === 'object' && resendError !== null ? (resendError as Record<string, unknown>) : null
      logger.error('Error resending invitation', resendError, {
        invitationId,
        statusCode: err?.['statusCode'],
        status: err?.['status'],
        errors: err?.['errors'],
        clerkError: err?.['clerkError']
      })
      
      // Extract more specific error message
      let errorMessage = (err && typeof err['message'] === 'string' ? (err['message'] as string) : '') || 'Unknown error'
      const errorsValue = err ? err['errors'] : undefined
      if (Array.isArray(errorsValue) && errorsValue.length > 0) {
        const firstError = errorsValue[0]
        const firstErrorRecord = asRecord(firstError)
        errorMessage =
          (firstErrorRecord && typeof firstErrorRecord['longMessage'] === 'string'
            ? (firstErrorRecord['longMessage'] as string)
            : undefined) ||
          (firstErrorRecord && typeof firstErrorRecord['message'] === 'string' ? (firstErrorRecord['message'] as string) : undefined) ||
          errorMessage
      }
      
      throw createError({
        statusCode:
          (err && typeof err['statusCode'] === 'number' ? (err['statusCode'] as number) : undefined) ||
          (err && typeof err['status'] === 'number' ? (err['status'] as number) : undefined) ||
          500,
        statusMessage: `Failed to resend invitation: ${errorMessage}`,
        data: resendError
      })
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/admin/invitations/[id]/resend')
  }
})

