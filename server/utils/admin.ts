import { getClerkUser } from './clerk'
import { logger } from './logger'

/**
 * Check if a user has admin role in Clerk metadata
 * @param clerkId - The Clerk user ID
 * @returns true if user has admin role, false otherwise
 */
export async function checkIsAdmin(clerkId: string): Promise<boolean> {
  try {
    const clerkUser = await getClerkUser(clerkId)
    const role = clerkUser.publicMetadata?.role as string | undefined
    return role === 'admin'
  } catch (error) {
    logger.error('Error checking admin status', error, { clerkId })
    return false
  }
}

/**
 * Require admin role - throws error if user is not admin
 * @param clerkId - The Clerk user ID
 * @throws Error with 403 status if user is not admin
 */
export async function requireAdmin(clerkId: string): Promise<void> {
  if (!clerkId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Clerk ID required'
    })
  }

  const isAdmin = await checkIsAdmin(clerkId)
  
  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden - Admin access required'
    })
  }
}

