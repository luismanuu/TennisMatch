import { requireAdmin } from '~/server/utils/admin'
import { getAllClerkInvitations } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { adminInvitationsListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { getOrSetTtlCache } from '~/server/utils/ttl-cache'

type InvitationPublicMetadata = Record<string, unknown> & {
  name?: unknown
  category_id?: unknown
  category_name?: unknown
}

type DashboardInvitation = {
  id: string
  clerk_invitation_id: string
  email: string
  name: string
  category_id: string | null
  category: { id: string | null; name: string } | null
  status: string
  created_at: string
  updated_at: string
  revoked: boolean
  /** Internal-only; used for filtering. */
  _originalStatus?: string | null
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminInvitationsListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    const cacheKey = `admin:invitations:v1:${offset}:${limit}`
    return await getOrSetTtlCache(cacheKey, 60_000, async () => {
      // Get all invitations directly from Clerk
      const { invitations: clerkInvitations, total: clerkTotal } = await getAllClerkInvitations()

      logger.info('Received invitations from Clerk', { count: clerkInvitations.length, total: clerkTotal })

      // Transform Clerk invitations to a format compatible with the dashboard
      const formattedInvitations: DashboardInvitation[] = clerkInvitations.map((inv) => {
        const metadata: InvitationPublicMetadata =
          typeof inv.publicMetadata === 'object' && inv.publicMetadata !== null
            ? (inv.publicMetadata as InvitationPublicMetadata)
            : {}
        // Determine status: if revoked, it's revoked; otherwise use the status from Clerk
        // Clerk status can be: 'pending', 'accepted', 'revoked', or undefined
        const isRevoked = inv.revoked === true
        // Get the original status from Clerk (might be undefined, null, or a string)
        const originalClerkStatus = inv.status
        // Default to 'pending' if status is not set, but preserve the original for filtering
        const clerkStatus = originalClerkStatus || 'pending'
        const status = isRevoked ? 'revoked' : clerkStatus

        const email = inv.emailAddress || ''
        const nameFromMetadata = typeof metadata.name === 'string' ? metadata.name : undefined
        const categoryId = typeof metadata.category_id === 'string' ? metadata.category_id : null
        const categoryName =
          typeof metadata.category_name === 'string' ? metadata.category_name : undefined

        const formatted: DashboardInvitation = {
          id: inv.id,
          clerk_invitation_id: inv.id,
          email,
          name: nameFromMetadata || email.split('@')[0] || 'Unknown',
          category_id: categoryId,
          category: categoryName
            ? {
                id: categoryId,
                name: categoryName,
              }
            : null,
          status: status,
          created_at: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
          updated_at: inv.updatedAt ? new Date(inv.updatedAt).toISOString() : new Date().toISOString(),
          revoked: isRevoked,
          _originalStatus: originalClerkStatus ?? null,
        }

        return formatted
      })

      // Filter to show only pending invitations by default
      const pendingInvitations = formattedInvitations.filter(inv => {
        const originalStatus = inv._originalStatus
        const statusLower = (inv.status || '').toLowerCase()
        const isAccepted = statusLower === 'accepted'
        const isRevoked = inv.revoked === true || statusLower === 'revoked'

        // More permissive: if not explicitly accepted or revoked, consider it pending
        const hasPendingStatus =
          statusLower === 'pending' ||
          originalStatus === undefined ||
          originalStatus === null ||
          (!isAccepted && !isRevoked)

        return (!isRevoked) && hasPendingStatus
      })

      logger.info('Filtered pending invitations', {
        pendingCount: pendingInvitations.length,
        totalCount: formattedInvitations.length,
      })

      // Apply pagination
      const totalPending = pendingInvitations.length
      const paginatedPending = pendingInvitations.slice(offset, offset + limit)
      const paginatedAll = formattedInvitations.slice(offset, offset + limit)

      return {
        invitations: paginatedPending,
        allInvitations: paginatedAll,
        total: totalPending,
        total_all: clerkTotal,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
      }
    })
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/invitations')
  }
})

