import { clerkClient } from '@clerk/clerk-sdk-node'

export async function getClerkUser(clerkId: string) {
  const config = useRuntimeConfig()
  
  if (!config.clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured')
  }
  
  // Set the secret key if not already set
  // Clerk SDK reads from process.env, but we can also set it directly
  if (!process.env.CLERK_SECRET_KEY && !process.env.NUXT_CLERK_SECRET_KEY) {
    process.env.CLERK_SECRET_KEY = config.clerkSecretKey
  }
  
  try {
    const user = await clerkClient.users.getUser(clerkId)
    return user
  } catch (error) {
    console.error('Error fetching Clerk user:', error)
    throw error
  }
}

export async function updateClerkUserName(clerkId: string, name: string) {
  const config = useRuntimeConfig()
  
  if (!config.clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured')
  }
  
  // Set the secret key if not already set
  if (!process.env.CLERK_SECRET_KEY && !process.env.NUXT_CLERK_SECRET_KEY) {
    process.env.CLERK_SECRET_KEY = config.clerkSecretKey
  }
  
  try {
    // Parse name into first and last name
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    const user = await clerkClient.users.updateUser(clerkId, {
      firstName,
      lastName
    })
    return user
  } catch (error) {
    console.error('Error updating Clerk user name:', error)
    throw error
  }
}

// Note: Clerk ID is passed from the client in the request body/query
// Server-side Clerk verification would require JWT token parsing
// For now, we rely on the client to pass clerk_id and verify it server-side

