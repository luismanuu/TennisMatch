import { createClerkClient } from '@clerk/clerk-sdk-node'
import { logger } from './logger'
import { InternalServerError } from './errors'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const r = asRecord(obj)
  const v = r ? r[key] : undefined
  return typeof v === 'string' ? v : undefined
}

function getNumberProp(obj: unknown, key: string): number | undefined {
  const r = asRecord(obj)
  const v = r ? r[key] : undefined
  return typeof v === 'number' ? v : undefined
}

// Get Clerk client with secret key
export function getClerkClient() {
  const config = useRuntimeConfig()
  
  if (!config.clerkSecretKey) {
    const error = new Error('CLERK_SECRET_KEY is not configured. Please set NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY in your environment variables.')
    logger.error('Clerk configuration error', error)
    throw error
  }
  
  // Verify the secret key format (should start with 'sk_')
  if (!config.clerkSecretKey.startsWith('sk_')) {
    const error = new Error('Invalid CLERK_SECRET_KEY format. Secret keys should start with "sk_"')
    logger.error('Clerk configuration error', error)
    throw error
  }
  
  // Create client with secret key directly
  try {
    return createClerkClient({ secretKey: config.clerkSecretKey })
  } catch (error) {
    logger.error('Error creating Clerk client', error)
    throw new InternalServerError('Failed to create Clerk client', { error })
  }
}

export async function getClerkUser(clerkId: string) {
  try {
    const client = getClerkClient()
    const user = await client.users.getUser(clerkId)
    return user
  } catch (error) {
    logger.error('Error fetching Clerk user', error, { clerkId })
    throw error
  }
}

export async function updateClerkUserName(clerkId: string, name: string) {
  try {
    const client = getClerkClient()
    
    // Parse name into first and last name
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    const user = await client.users.updateUser(clerkId, {
      firstName,
      lastName
    })
    return user
  } catch (error) {
    logger.error('Error updating Clerk user name', error, { clerkId, name })
    throw error
  }
}

export async function createInvitation(email: string, name: string, invitationToken: string) {
  try {
    const client = getClerkClient()
    const config = useRuntimeConfig()
    
    // Get the base URL for invitation links
    const baseUrl = config.public?.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationUrl = `${baseUrl}/invitation/${invitationToken}`
    
    logger.debug('Creating Clerk invitation', { email, name, invitationUrl, baseUrl })
    
    // Check if user already exists in Clerk
    try {
      const existingUsers = await client.users.getUserList({ emailAddress: [email] })
      if (Array.isArray(existingUsers) && existingUsers.length > 0) {
        const existingUser = existingUsers[0]!
        throw createError({
          statusCode: 409,
          statusMessage: `A user with email ${email} already exists in Clerk (User ID: ${existingUser.id}). Please delete the existing user first or use a different email.`,
          data: {
            existingUserId: existingUser.id,
            existingUserEmail: existingUser.emailAddresses?.[0]?.emailAddress
          }
        })
      }
    } catch (checkError: unknown) {
      // If it's our custom error about existing user, re-throw it
      const ce = asRecord(checkError)
      if (ce && ce['statusCode'] === 409) {
        throw checkError
      }
      // Otherwise, log but continue (might be a different error)
      logger.warn('Could not check for existing user', { message: getStringProp(checkError, 'message'), email })
    }
    
    // Revoke any existing pending invitations for this email
    // This prevents the "invitation already exists" error
    await revokePendingInvitationsByEmail(email)
    
    // Prepare invitation payload
    const invitationPayload: {
      emailAddress: string
      publicMetadata?: Record<string, unknown>
      redirectUrl?: string
    } = {
      emailAddress: email
    }
    
    // Add publicMetadata if provided
    if (name || invitationToken) {
      invitationPayload.publicMetadata = {}
      if (name) {
        invitationPayload.publicMetadata.name = name
      }
      if (invitationToken) {
        invitationPayload.publicMetadata.invitationToken = invitationToken
      }
    }
    
    // Add redirectUrl if provided
    if (invitationUrl) {
      invitationPayload.redirectUrl = invitationUrl
    }
    
    logger.debug('Clerk invitation payload', { payload: invitationPayload })
    
    // Create invitation via Clerk
    // Note: Clerk automatically sends the invitation email when createInvitation is called
    // However, emails may not be sent if:
    // 1. Email provider is not configured in Clerk Dashboard
    // 2. You're in development mode with email sending disabled
    // 3. Email delivery is delayed or blocked
    // 4. Development email limit (100/month) has been reached - use test emails instead
    //    See: https://go.clerk.com/test-emails or docs/CLERK_TEST_EMAILS.md
    const invitation = await client.invitations.createInvitation(invitationPayload)
    
    logger.info('Clerk invitation created', {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status,
      createdAt: invitation.createdAt,
      revoked: invitation.revoked
    })
    
    // Warn if invitation status suggests email might not have been sent
    if (invitation.status === 'pending' || invitation.status === 'revoked') {
      logger.warn('Clerk invitation created but email delivery status unclear. Check Clerk Dashboard > Email settings to ensure email provider is configured.', {
        invitationId: invitation.id,
        status: invitation.status
      })
    }
    
    return {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    }
  } catch (error: unknown) {
    // Log detailed error information
    const err = asRecord(error)
    let clerkErrors: Array<{
      message?: string
      code?: string
      longMessage?: string
      meta?: unknown
      fullError: unknown
    }> = []
    const errorsValue = err ? err['errors'] : undefined
    if (Array.isArray(errorsValue)) {
      clerkErrors = errorsValue.map((e) => {
        const er = asRecord(e)
        return {
          message: er ? (typeof er['message'] === 'string' ? (er['message'] as string) : undefined) : undefined,
          code: er ? (typeof er['code'] === 'string' ? (er['code'] as string) : undefined) : undefined,
          longMessage: er ? (typeof er['longMessage'] === 'string' ? (er['longMessage'] as string) : undefined) : undefined,
          meta: er ? er['meta'] : undefined,
          fullError: e
        }
      })
    }
    
    const errorDetails = {
      message: getStringProp(error, 'message'),
      status: getNumberProp(error, 'status'),
      statusCode: getNumberProp(error, 'statusCode'),
      clerkError: err ? err['clerkError'] : undefined,
      clerkTraceId: err ? err['clerkTraceId'] : undefined,
      errors: err ? err['errors'] : undefined,
      clerkErrors: clerkErrors,
      // Try to stringify the full error for debugging
      errorString: typeof (error as { toString?: unknown })?.toString === 'function' ? String(error) : undefined,
      stack: getStringProp(error, 'stack')
    }
    
    logger.error('Error creating Clerk invitation', error, { errorDetails })
    
    // Extract more specific error message
    let errorMessage = getStringProp(error, 'message') || 'Unknown error creating invitation'
    
    // Check if it's a Clerk API error with more details
    if (clerkErrors.length > 0) {
      const firstError = clerkErrors[0]
      errorMessage = firstError?.longMessage || firstError?.message || errorMessage
      
      // Check for specific error codes
      if (firstError?.code === 'form_identifier_exists') {
        errorMessage = `A user with email ${email} already exists in Clerk. Please use a different email or delete the existing user first.`
      } else if (firstError?.code === 'form_param_format_invalid') {
        errorMessage = `Invalid email format or invitation parameters: ${firstError?.message || errorMessage}`
      } else if (firstError?.code === 'form_identifier_invalid') {
        errorMessage = `Invalid email address format: ${email}. ${firstError?.longMessage || firstError?.message || ''}`
      } else if (firstError?.code === 'form_param_value_invalid') {
        errorMessage = `Invalid parameter value: ${firstError?.longMessage || firstError?.message || errorMessage}`
      }
      
      // Include the error code in the message
      if (firstError?.code) {
        errorMessage = `[${firstError.code}] ${errorMessage}`
      }
    }
    
    throw createError({
      statusCode: getNumberProp(error, 'statusCode') || getNumberProp(error, 'status') || 500,
      statusMessage: `Failed to create Clerk invitation: ${errorMessage}`,
      data: {
        ...errorDetails,
        originalError: error
      }
    })
  }
}

export async function revokePendingInvitationsByEmail(email: string) {
  try {
    const client = getClerkClient()
    
    logger.debug('Revoking pending invitations for email', { email })
    
    // Get all invitations for this email
    const invitations = await client.invitations.getInvitationList(
      { emailAddress: email } as unknown as Parameters<typeof client.invitations.getInvitationList>[0]
    )
    
    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      logger.debug('No pending invitations found for email', { email })
      return { revoked: 0 }
    }
    
    // Revoke all pending invitations
    let revokedCount = 0
    for (const invitation of invitations) {
      // Only revoke if it's pending and not already revoked
      if (invitation.status === 'pending' && !invitation.revoked) {
        try {
          await client.invitations.revokeInvitation(invitation.id)
          revokedCount++
          logger.debug('Revoked invitation', { invitationId: invitation.id, email })
        } catch (revokeError: unknown) {
          logger.warn('Could not revoke invitation', { invitationId: invitation.id, email, error: getStringProp(revokeError, 'message') })
        }
      }
    }
    
    logger.info('Successfully revoked invitations', { revokedCount, email })
    return { revoked: revokedCount }
  } catch (error: unknown) {
    logger.error('Error revoking pending invitations', error, {
      email,
      status: getNumberProp(error, 'status'),
      statusCode: getNumberProp(error, 'statusCode')
    })
    // Don't throw - this is a cleanup operation, shouldn't fail the main flow
    return { revoked: 0, error: getStringProp(error, 'message') }
  }
}

export async function getAllClerkInvitations() {
  try {
    const client = getClerkClient()
    
    const invitations = await client.invitations.getInvitationList()
    const allInvitations = Array.isArray(invitations) ? invitations : []
    const totalCount = allInvitations.length
    
    logger.info('Found Clerk invitations', { count: totalCount, total: totalCount })
    
    return {
      invitations: allInvitations,
      total: totalCount
    }
  } catch (error: unknown) {
    logger.error('Error fetching Clerk invitations', error, {
      status: getNumberProp(error, 'status'),
      statusCode: getNumberProp(error, 'statusCode')
    })
    
    throw createError({
      statusCode: getNumberProp(error, 'statusCode') || getNumberProp(error, 'status') || 500,
      statusMessage: `Failed to fetch Clerk invitations: ${getStringProp(error, 'message') || 'Unknown error'}`,
      data: error
    })
  }
}

export async function deleteClerkUser(clerkId: string) {
  try {
    const client = getClerkClient()
    
    logger.info('Deleting Clerk user', { clerkId })
    
    const deletedUser = await client.users.deleteUser(clerkId)
    
    logger.info('Clerk user deleted successfully', {
      id: deletedUser.id
    })
    
    return {
      id: deletedUser.id
    }
  } catch (error: unknown) {
    logger.error('Error deleting Clerk user', error, {
      clerkId,
      status: getNumberProp(error, 'status'),
      statusCode: getNumberProp(error, 'statusCode')
    })
    
    const errorMessage =
      getStringProp(error, 'message') ||
      getStringProp(asRecord(error)?.['clerkError'], 'message') ||
      'Unknown error deleting user'
    throw createError({
      statusCode: getNumberProp(error, 'statusCode') || getNumberProp(error, 'status') || 500,
      statusMessage: `Failed to delete Clerk user: ${errorMessage}`,
      data: error
    })
  }
}

export async function resendInvitation(
  clerkInvitationId: string | null | undefined,
  email: string,
  name: string,
  invitationToken: string
) {
  try {
    const client = getClerkClient()
    const config = useRuntimeConfig()
    
    // Get the base URL for invitation links
    const baseUrl = config.public?.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationUrl = `${baseUrl}/invitation/${invitationToken}`
    
    // If there's an existing invitation, revoke it first
    if (clerkInvitationId) {
      try {
        logger.debug('Revoking existing Clerk invitation', { clerkInvitationId })
        await client.invitations.revokeInvitation(clerkInvitationId)
        logger.debug('Successfully revoked old invitation', { clerkInvitationId })
      } catch (revokeError: unknown) {
        // If invitation doesn't exist or is already revoked, that's okay
        // We'll just create a new one
        logger.warn('Could not revoke invitation (may not exist)', { clerkInvitationId, error: getStringProp(revokeError, 'message') })
      }
    }
    
    // Create new invitation (Clerk automatically sends the email)
    logger.debug('Creating new Clerk invitation for resend', {
      email,
      name,
      invitationToken,
      invitationUrl
    })
    
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        name,
        invitationToken
      },
      redirectUrl: invitationUrl
    })
    
    logger.info('New Clerk invitation created successfully', {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    })
    
    return {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    }
  } catch (error: unknown) {
    logger.error('Error resending Clerk invitation', error, {
      clerkInvitationId,
      email,
      status: getNumberProp(error, 'status'),
      statusCode: getNumberProp(error, 'statusCode')
    })
    
    const errorMessage =
      getStringProp(error, 'message') ||
      getStringProp(asRecord(error)?.['clerkError'], 'message') ||
      'Unknown error resending invitation'
    throw createError({
      statusCode: getNumberProp(error, 'statusCode') || getNumberProp(error, 'status') || 500,
      statusMessage: `Failed to resend Clerk invitation: ${errorMessage}`,
      data: error
    })
  }
}

// Note: Clerk ID is passed from the client in the request body/query
// Server-side Clerk verification would require JWT token parsing
// For now, we rely on the client to pass clerk_id and verify it server-side

