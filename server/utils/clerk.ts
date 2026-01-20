import { createClerkClient } from '@clerk/clerk-sdk-node'

// Get Clerk client with secret key
export function getClerkClient() {
  const config = useRuntimeConfig()
  
  if (!config.clerkSecretKey) {
    const error = new Error('CLERK_SECRET_KEY is not configured. Please set NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY in your environment variables.')
    console.error('Clerk configuration error:', error.message)
    throw error
  }
  
  // Verify the secret key format (should start with 'sk_')
  if (!config.clerkSecretKey.startsWith('sk_')) {
    const error = new Error('Invalid CLERK_SECRET_KEY format. Secret keys should start with "sk_"')
    console.error('Clerk configuration error:', error.message)
    throw error
  }
  
  // Create client with secret key directly
  try {
    return createClerkClient({ secretKey: config.clerkSecretKey })
  } catch (error) {
    console.error('Error creating Clerk client:', error)
    throw error
  }
}

export async function getClerkUser(clerkId: string) {
  try {
    const client = getClerkClient()
    const user = await client.users.getUser(clerkId)
    return user
  } catch (error) {
    console.error('Error fetching Clerk user:', error)
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
    console.error('Error updating Clerk user name:', error)
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
    
    console.log('Creating Clerk invitation with params:', {
      email,
      name,
      invitationUrl,
      baseUrl
    })
    
    // Check if user already exists in Clerk
    try {
      const existingUsers = await client.users.getUserList({ emailAddress: [email] })
      if (existingUsers && existingUsers.data && existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0]
        throw createError({
          statusCode: 409,
          statusMessage: `A user with email ${email} already exists in Clerk (User ID: ${existingUser.id}). Please delete the existing user first or use a different email.`,
          data: {
            existingUserId: existingUser.id,
            existingUserEmail: existingUser.emailAddresses?.[0]?.emailAddress
          }
        })
      }
    } catch (checkError: any) {
      // If it's our custom error about existing user, re-throw it
      if (checkError.statusCode === 409) {
        throw checkError
      }
      // Otherwise, log but continue (might be a different error)
      console.warn('Warning: Could not check for existing user:', checkError?.message)
    }
    
    // Revoke any existing pending invitations for this email
    // This prevents the "invitation already exists" error
    await revokePendingInvitationsByEmail(email)
    
    // Prepare invitation payload
    const invitationPayload: any = {
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
    
    console.log('Clerk invitation payload:', JSON.stringify(invitationPayload, null, 2))
    
    // Create invitation via Clerk
    // Note: Clerk automatically sends the invitation email when createInvitation is called
    // However, emails may not be sent if:
    // 1. Email provider is not configured in Clerk Dashboard
    // 2. You're in development mode with email sending disabled
    // 3. Email delivery is delayed or blocked
    // 4. Development email limit (100/month) has been reached - use test emails instead
    //    See: https://go.clerk.com/test-emails or CLERK_TEST_EMAILS.md
    const invitation = await client.invitations.createInvitation(invitationPayload)
    
    console.log('Clerk invitation response:', {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status,
      createdAt: invitation.createdAt,
      publicMetadata: invitation.publicMetadata,
      // Log additional fields if available
      revoked: invitation.revoked,
      expiresAt: invitation.expiresAt
    })
    
    // Warn if invitation status suggests email might not have been sent
    if (invitation.status === 'pending' || invitation.status === 'revoked') {
      console.warn('⚠️ Clerk invitation created but email delivery status unclear. Check Clerk Dashboard > Email settings to ensure email provider is configured.')
    }
    
    return {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    }
  } catch (error: any) {
    // Log detailed error information
    let clerkErrors = []
    if (error?.errors && Array.isArray(error.errors)) {
      clerkErrors = error.errors.map((e: any) => ({
        message: e?.message,
        code: e?.code,
        longMessage: e?.longMessage,
        meta: e?.meta,
        fullError: e
      }))
    }
    
    const errorDetails = {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      clerkError: error?.clerkError,
      clerkTraceId: error?.clerkTraceId,
      errors: error?.errors,
      clerkErrors: clerkErrors,
      // Try to stringify the full error for debugging
      errorString: error?.toString?.(),
      stack: error?.stack
    }
    
    console.error('Error creating Clerk invitation - Full error details:', JSON.stringify(errorDetails, null, 2))
    
    // Also log the raw error object
    console.error('Raw Clerk error object:', error)
    
    // Extract more specific error message
    let errorMessage = error?.message || 'Unknown error creating invitation'
    
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
      statusCode: error?.statusCode || error?.status || 500,
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
    
    console.log('Revoking pending invitations for email:', email)
    
    // Get all invitations for this email
    const invitations = await client.invitations.getInvitationList({ emailAddress: email })
    
    if (!invitations || !invitations.data || invitations.data.length === 0) {
      console.log('No pending invitations found for email:', email)
      return { revoked: 0 }
    }
    
    // Revoke all pending invitations
    let revokedCount = 0
    for (const invitation of invitations.data) {
      // Only revoke if it's pending and not already revoked
      if (invitation.status === 'pending' && !invitation.revoked) {
        try {
          await client.invitations.revokeInvitation(invitation.id)
          revokedCount++
          console.log(`Revoked invitation ${invitation.id} for ${email}`)
        } catch (revokeError: any) {
          console.warn(`Could not revoke invitation ${invitation.id}:`, revokeError?.message)
        }
      }
    }
    
    console.log(`Successfully revoked ${revokedCount} invitation(s) for ${email}`)
    return { revoked: revokedCount }
  } catch (error: any) {
    console.error('Error revoking pending invitations:', {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      email
    })
    // Don't throw - this is a cleanup operation, shouldn't fail the main flow
    return { revoked: 0, error: error?.message }
  }
}

export async function getAllClerkInvitations() {
  try {
    const client = getClerkClient()
    
    let allInvitations: any[] = []
    let totalCount = 0
    
    // Try multiple approaches to fetch invitations
    const approaches = [
      {
        name: 'No parameters (default)',
        params: {}
      },
      {
        name: 'With limit only',
        params: { limit: 100 }
      },
      {
        name: 'Status pending only',
        params: { status: 'pending' }
      },
      {
        name: 'Status pending with limit',
        params: { status: 'pending', limit: 100 }
      }
    ]
    
    for (const approach of approaches) {
      try {
        const response = await client.invitations.getInvitationList(approach.params as any)
        
        if (response?.data && response.data.length > 0) {
          // Merge invitations, avoiding duplicates
          const existingIds = new Set(allInvitations.map(inv => inv.id))
          const newInvitations = response.data.filter((inv: any) => !existingIds.has(inv.id))
          allInvitations = allInvitations.concat(newInvitations)
          totalCount = response.totalCount || Math.max(totalCount, allInvitations.length)
          
          // If we got results, we can stop trying other approaches
          if (allInvitations.length > 0) {
            break
          }
        } else if (response?.totalCount !== undefined) {
          totalCount = response.totalCount
        }
      } catch (error: any) {
        // Continue to next approach
        continue
      }
    }
    
    // If still no invitations, try one more time with minimal params
    if (allInvitations.length === 0) {
      try {
        const response = await client.invitations.getInvitationList()
        
        if (Array.isArray(response)) {
          allInvitations = response
          totalCount = response.length
        } else if (response?.data) {
          allInvitations = Array.isArray(response.data) ? response.data : []
          totalCount = response.totalCount || allInvitations.length
        }
      } catch (finalError: any) {
        // Silently fail - we've tried all approaches
      }
    }
    
    console.log(`[getAllClerkInvitations] Found ${allInvitations.length} invitations in Clerk (total: ${totalCount})`)
    
    return {
      invitations: allInvitations,
      total: totalCount
    }
  } catch (error: any) {
    console.error('Error fetching Clerk invitations:', {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode
    })
    
    throw createError({
      statusCode: error?.statusCode || error?.status || 500,
      statusMessage: `Failed to fetch Clerk invitations: ${error?.message || 'Unknown error'}`,
      data: error
    })
  }
}

export async function deleteClerkUser(clerkId: string) {
  try {
    const client = getClerkClient()
    
    console.log('Deleting Clerk user:', clerkId)
    
    const deletedUser = await client.users.deleteUser(clerkId)
    
    console.log('Clerk user deleted successfully:', {
      id: deletedUser.id,
      deleted: deletedUser.deleted
    })
    
    return {
      id: deletedUser.id,
      deleted: deletedUser.deleted
    }
  } catch (error: any) {
    console.error('Error deleting Clerk user - Full error details:', {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      errors: error?.errors,
      clerkError: error?.clerkError,
      stack: error?.stack
    })
    
    const errorMessage = error?.message || error?.clerkError?.message || 'Unknown error deleting user'
    throw createError({
      statusCode: error?.statusCode || error?.status || 500,
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
        console.log('Revoking existing Clerk invitation:', clerkInvitationId)
        await client.invitations.revokeInvitation(clerkInvitationId)
        console.log('Successfully revoked old invitation')
      } catch (revokeError: any) {
        // If invitation doesn't exist or is already revoked, that's okay
        // We'll just create a new one
        console.warn('Could not revoke invitation (may not exist):', revokeError?.message)
      }
    }
    
    // Create new invitation (Clerk automatically sends the email)
    console.log('Creating new Clerk invitation for resend:', {
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
    
    console.log('New Clerk invitation created successfully:', {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    })
    
    return {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    }
  } catch (error: any) {
    console.error('Error resending Clerk invitation - Full error details:', {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      errors: error?.errors,
      clerkError: error?.clerkError,
      stack: error?.stack
    })
    
    const errorMessage = error?.message || error?.clerkError?.message || 'Unknown error resending invitation'
    throw createError({
      statusCode: error?.statusCode || error?.status || 500,
      statusMessage: `Failed to resend Clerk invitation: ${errorMessage}`,
      data: error
    })
  }
}

// Note: Clerk ID is passed from the client in the request body/query
// Server-side Clerk verification would require JWT token parsing
// For now, we rely on the client to pass clerk_id and verify it server-side

