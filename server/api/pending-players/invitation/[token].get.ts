import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getAllClerkInvitations } from '~/server/utils/clerk'

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
      const clerkInvitation = invitations.find((inv: any) => {
        const metadata = (inv.publicMetadata as any) || {}
        return metadata.invitationToken === token
      })
      
      if (clerkInvitation) {
        // Found in Clerk - check if it's valid
        if (clerkInvitation.revoked) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invitation has been revoked'
          })
        }
        
        const metadata = (clerkInvitation.publicMetadata as any) || {}
        
        // Return in the same format as database pending player
        return {
          id: clerkInvitation.id,
          name: metadata.name || clerkInvitation.emailAddress?.split('@')[0] || 'Unknown',
          email: clerkInvitation.emailAddress || '',
          category_id: metadata.category_id || null,
          category: metadata.category_name ? {
            id: metadata.category_id,
            name: metadata.category_name,
            description: null,
            order: null
          } : null,
          invited_by_player_id: null,
          invited_by_player: null,
          clerk_invitation_id: clerkInvitation.id,
          invitation_token: token,
          status: clerkInvitation.revoked ? 'revoked' : (clerkInvitation.status || 'pending'),
          created_at: clerkInvitation.createdAt ? new Date(clerkInvitation.createdAt).toISOString() : new Date().toISOString(),
          updated_at: clerkInvitation.updatedAt ? new Date(clerkInvitation.updatedAt).toISOString() : new Date().toISOString()
        }
      }
    } catch (clerkError: any) {
      // If it's a 400 error (revoked/expired), re-throw it
      if (clerkError.statusCode === 400) {
        throw clerkError
      }
      // Otherwise, continue to check database
      console.warn('Error checking Clerk invitations, falling back to database:', clerkError?.message)
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
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

