import { requireAdmin } from '~/server/utils/admin'
import { getAllClerkInvitations } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    // Get all invitations directly from Clerk
    const { invitations: clerkInvitations, total: clerkTotal } = await getAllClerkInvitations()

    console.log(`[invitations.get] Received ${clerkInvitations.length} invitations from Clerk (total: ${clerkTotal})`)

    // Transform Clerk invitations to a format compatible with the dashboard
    const formattedInvitations = clerkInvitations.map((inv) => {
      const metadata = inv.publicMetadata as any || {}
      // Determine status: if revoked, it's revoked; otherwise use the status from Clerk
      // Clerk status can be: 'pending', 'accepted', 'revoked', or undefined
      const isRevoked = inv.revoked === true
      // Get the original status from Clerk (might be undefined, null, or a string)
      const originalClerkStatus = inv.status
      // Default to 'pending' if status is not set, but preserve the original for filtering
      const clerkStatus = originalClerkStatus || 'pending'
      const status = isRevoked ? 'revoked' : clerkStatus
      
      
      const formatted = {
        id: inv.id,
        clerk_invitation_id: inv.id,
        email: inv.emailAddress || '',
        name: metadata.name || inv.emailAddress?.split('@')[0] || 'Unknown',
        category_id: metadata.category_id || null,
        category: metadata.category_name ? {
          id: metadata.category_id,
          name: metadata.category_name
        } : null,
        status: status,
        created_at: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
        updated_at: inv.updatedAt ? new Date(inv.updatedAt).toISOString() : new Date().toISOString(),
        revoked: isRevoked,
        expiresAt: inv.expiresAt
      }
      
      // Store original status for filtering (internal use only)
      ;(formatted as any)._originalStatus = originalClerkStatus
      
      return formatted
    })

    // Filter to show only pending invitations by default
    // Show invitations that are not revoked and have status 'pending'
    // Also include invitations that don't have a status set (might be older invitations)
    const pendingInvitations = formattedInvitations.filter(inv => {
      // Consider pending if:
      // 1. Not revoked AND
      // 2. Status is 'pending' (either explicitly set or defaulted), OR
      // 3. Original status was undefined/null (meaning it's truly pending in Clerk), OR
      // 4. Status is not 'accepted' and not 'revoked' (catch-all for pending invitations)
      const originalStatus = (inv as any)._originalStatus
      const statusLower = (inv.status || '').toLowerCase()
      const isAccepted = statusLower === 'accepted'
      const isRevoked = inv.revoked === true || statusLower === 'revoked'
      
      // More permissive: if not explicitly accepted or revoked, consider it pending
      const hasPendingStatus = statusLower === 'pending' || 
                               originalStatus === undefined || 
                               originalStatus === null ||
                               (!isAccepted && !isRevoked)
      
      return (!isRevoked) && hasPendingStatus
    })

    console.log(`[invitations.get] Filtered to ${pendingInvitations.length} pending invitations out of ${formattedInvitations.length} total`)

    return {
      invitations: pendingInvitations,
      allInvitations: formattedInvitations,
      total: clerkTotal
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

