import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getAllClerkInvitations, getClerkClient } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { adminOrganizersListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { getOrSetTtlCache } from '~/server/utils/ttl-cache'

type PlayerRow = {
  id: string
  name: string | null
  clerk_id: string | null
  created_at: string
  updated_at: string
}

type ClerkEmailAddress = { emailAddress?: string | null }

type ClerkUserLike = {
  id: string
  emailAddresses?: ClerkEmailAddress[]
  publicMetadata?: Record<string, unknown>
}

type OrganizerDto = {
  id: string
  clerk_id: string | null
  name: string | null
  email: string
  created_at: string
  updated_at: string
}

type PendingInvitationDto = {
  id: string
  email: string | null | undefined
  name: string
  status: string | null | undefined
  created_at: unknown
}

function getRoleFromPublicMetadata(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const role = (meta as Record<string, unknown>)['role']
  return typeof role === 'string' ? role : undefined
}

function getNameFromPublicMetadata(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const name = (meta as Record<string, unknown>)['name']
  return typeof name === 'string' ? name : undefined
}

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminOrganizersListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    await requireAdmin(clerkId)

    // This endpoint hits Clerk + scans players; cache briefly to avoid repeated work in admin UI.
    const cacheKey = `admin:organizers:v1:${offset}:${limit}`
    return await getOrSetTtlCache(cacheKey, 60_000, async () => {
      const supabase = getSupabaseAdmin()
      const clerkClient = getClerkClient()

      // Get all players (role lives in Clerk metadata, so we can't filter in DB)
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('id, name, clerk_id, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (playersError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch players',
          data: playersError
        })
      }

    // Get Clerk users in batches to check their roles (avoid N+1)
    const clerkUsersById = new Map<string, ClerkUserLike>()
    const players = (allPlayers || []) as unknown as PlayerRow[]
    const clerkIds = players
      .map((p) => p.clerk_id || undefined)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    const CHUNK_SIZE = 100
    for (let i = 0; i < clerkIds.length; i += CHUNK_SIZE) {
      const chunk = clerkIds.slice(i, i + CHUNK_SIZE)
      try {
        // Clerk SDK supports list filtering by emailAddress; in practice it also supports userId arrays.
        // We keep this cast to stay resilient across SDK typings.
        const users = await clerkClient.users.getUserList(
          { userId: chunk } as unknown as Parameters<typeof clerkClient.users.getUserList>[0]
        )
        if (Array.isArray(users)) {
          users.forEach((u) => {
            const maybe = u as unknown as Partial<ClerkUserLike>
            if (typeof maybe?.id === 'string') clerkUsersById.set(maybe.id, maybe as ClerkUserLike)
          })
        }
      } catch (err) {
        // Fallback to individual fetches if batch query isn't supported by the SDK/environment.
        logger.warn('Batch Clerk user fetch failed; falling back to per-user', { error: err })
        for (const id of chunk) {
          try {
            const u = await clerkClient.users.getUser(id)
            if (u?.id) clerkUsersById.set(u.id, u)
          } catch (innerErr) {
            logger.warn('Could not fetch Clerk user', { error: innerErr, clerkId: id })
          }
        }
      }
    }

    // Build organizers from players + Clerk role/email
    const organizers: OrganizerDto[] = []
    
    for (const player of players) {
      const clerkUser = player.clerk_id ? clerkUsersById.get(player.clerk_id) : undefined
      const role = getRoleFromPublicMetadata(clerkUser?.publicMetadata)

      if (role === 'tournament_organizer') {
        organizers.push({
          id: player.id,
          clerk_id: player.clerk_id,
          name: player.name,
          email: clerkUser?.emailAddresses?.[0]?.emailAddress || '',
          created_at: player.created_at,
          updated_at: player.updated_at
        })
      }
    }

    // Also get pending invitations for tournament organizers
    const { invitations: clerkInvitations } = await getAllClerkInvitations()
    const allPendingInvitations: PendingInvitationDto[] = clerkInvitations
      .filter((inv) => {
        const role = getRoleFromPublicMetadata((inv as { publicMetadata?: unknown }).publicMetadata)
        const revoked = (inv as { revoked?: unknown }).revoked === true
        return role === 'tournament_organizer' && !revoked
      })
      .map((inv) => {
        const invAny = inv as {
          id: string
          emailAddress?: string | null
          status?: string | null
          createdAt?: unknown
          publicMetadata?: unknown
        }
        const name = getNameFromPublicMetadata(invAny.publicMetadata)
        const email = invAny.emailAddress
        return {
          id: invAny.id,
          email,
          name: name || email?.split('@')[0] || 'Unknown',
          status: invAny.status,
          created_at: invAny.createdAt
        }
      })
    
    // Apply pagination to organizers
    const totalOrganizers = organizers.length
    const paginatedOrganizers = organizers.slice(offset, offset + limit)
    
    // Apply pagination to pending invitations
    const totalPending = allPendingInvitations.length
    const paginatedPending = allPendingInvitations.slice(offset, offset + limit)

      return {
        organizers: paginatedOrganizers,
        pendingInvitations: paginatedPending,
        total: totalOrganizers,
        total_pending: totalPending,
        page: Math.floor(offset / limit) + 1,
        page_size: limit
      }
    })
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/organizers/index')
  }
})

