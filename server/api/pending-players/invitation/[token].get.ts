import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getAllClerkInvitations } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const r = asRecord(obj)
  const v = r ? r[key] : undefined
  return typeof v === 'string' ? v : undefined
}

function toIsoNowFallback(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    
    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation token is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // First, try to find invitation in Clerk (for admin-created invitations)
    try {
      const { invitations } = await getAllClerkInvitations()
      const typedInvitations = invitations as unknown as Array<{
        id: string
        emailAddress?: string | null
        revoked?: boolean
        status?: string | null
        createdAt?: unknown
        updatedAt?: unknown
        publicMetadata?: unknown
      }>
      const clerkInvitation = typedInvitations.find((inv) => getStringProp(inv.publicMetadata, 'invitationToken') === token)
      
      if (clerkInvitation) {
        // Found in Clerk - check if it's valid
        if (clerkInvitation.revoked) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invitation has been revoked'
          })
        }
        
        const metadata = asRecord(clerkInvitation.publicMetadata) ?? {}
        const role = getStringProp(metadata, 'role') || 'player'
        const categoryId = getStringProp(metadata, 'category_id') || null
        const categoryName = getStringProp(metadata, 'category_name') || null
        
        // Return in the same format as database pending player
        return {
          id: clerkInvitation.id,
          name: getStringProp(metadata, 'name') || clerkInvitation.emailAddress?.split('@')[0] || 'Unknown',
          email: clerkInvitation.emailAddress || '',
          category_id: categoryId,
          category: categoryId && categoryName ? {
            id: categoryId,
            name: categoryName,
            description: null,
            order: null
          } : null,
          invited_by_player_id: null,
          invited_by_player: null,
          clerk_invitation_id: clerkInvitation.id,
          invitation_token: token,
          status: clerkInvitation.revoked ? 'revoked' : (clerkInvitation.status || 'pending'),
          created_at: toIsoNowFallback(clerkInvitation.createdAt),
          updated_at: toIsoNowFallback(clerkInvitation.updatedAt),
          role: role // Include role to identify organizer invitations
        }
      }
    } catch (clerkError: unknown) {
      const err = typeof clerkError === 'object' && clerkError !== null ? (clerkError as Record<string, unknown>) : null
      // If it's a 400 error (revoked/expired), re-throw it
      if (err && err['statusCode'] === 400) {
        throw clerkError
      }
      // Otherwise, continue to check database
      logger.warn('Error checking Clerk invitations, falling back to database', { 
        error: err && typeof err['message'] === 'string' ? (err['message'] as string) : 'Unknown error',
        token 
      })
    }
    
    // Fallback: Check database for player-created invitations
    const { data: pendingPlayer, error } = await supabase
      .from('pending_players')
      .select(`
        *,
        category:categories(id, name, description, order),
        invited_by_player:players!pending_players_invited_by_player_id_fkey(id, name)
      `)
      .eq('invitation_token', token)
      .single()
    
    if (error || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found or invalid'
      })
    }
    
    // Check if invitation is still valid
    if (pendingPlayer.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Invitation has already been ${pendingPlayer.status}`
      })
    }
    
    return pendingPlayer
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/pending-players/invitation/[token]')
  }
})

