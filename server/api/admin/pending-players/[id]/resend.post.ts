import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { resendInvitation } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const pendingPlayerId = getRouterParam(event, 'id')
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body
    
    if (!pendingPlayerId || !clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: pending_player_id, clerk_id'
      })
    }
    
    // Verify admin access
    await requireAdmin(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Fetch pending player
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select('*')
      .eq('id', pendingPlayerId)
      .single()
    
    if (fetchError || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }
    
    // Only allow resending for pending invitations
    if (pendingPlayer.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot resend invitation - invitation status is ${pendingPlayer.status}`
      })
    }
    
    // Ensure invitation token exists
    if (!pendingPlayer.invitation_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pending player is missing invitation token'
      })
    }
    
    // Resend invitation via Clerk
    const invitation = await resendInvitation(
      pendingPlayer.clerk_invitation_id,
      pendingPlayer.email,
      pendingPlayer.name,
      pendingPlayer.invitation_token
    )
    
    // Update clerk_invitation_id in database
    const { error: updateError } = await supabase
      .from('pending_players')
      .update({
        clerk_invitation_id: invitation.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingPlayerId)
    
    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update pending player record',
        data: updateError
      })
    }
    
    return {
      success: true,
      message: 'Invitation email resent successfully. Note: If email is not received, check Clerk Dashboard > Email settings to ensure email provider is configured.',
      invitation_id: invitation.id,
      invitation_status: invitation.status
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

