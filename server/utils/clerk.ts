import { createClerkClient } from '@clerk/clerk-sdk-node'

// Get Clerk client with secret key
function getClerkClient() {
  const config = useRuntimeConfig()
  
  if (!config.clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured. Please set NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY in your environment variables.')
  }
  
  // Create client with secret key directly
  return createClerkClient({ secretKey: config.clerkSecretKey })
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
    
    // Create invitation via Clerk
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        name,
        invitationToken
      },
      // Optional: customize the redirect URL after sign-up
      redirectUrl: invitationUrl
    })
    
    return {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status
    }
  } catch (error) {
    console.error('Error creating Clerk invitation:', error)
    throw error
  }
}

// Note: Clerk ID is passed from the client in the request body/query
// Server-side Clerk verification would require JWT token parsing
// For now, we rely on the client to pass clerk_id and verify it server-side

