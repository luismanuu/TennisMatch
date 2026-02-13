import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser, revokePendingInvitationsByEmail } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'

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
    
    // Verify Clerk user exists
    const clerkUser = await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Fetch pending player
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select('id, status, email, name, category_id, clerk_invitation_id')
      .eq('id', pendingPlayerId)
      .single()
    
    if (fetchError || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }
    
    // Verify invitation is still pending
    if (pendingPlayer.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Invitation has already been ${pendingPlayer.status}`
      })
    }
    
    // Verify email matches Clerk user email
    const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress
    if (!clerkEmail || clerkEmail.toLowerCase() !== pendingPlayer.email.toLowerCase()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Email does not match the invitation'
      })
    }
    
    // Check if player already exists for this Clerk ID
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()
    
    if (existingPlayer) {
      // Revoke any remaining pending invitations in Clerk for this email
      try {
        await revokePendingInvitationsByEmail(pendingPlayer.email)
      } catch (revokeError) {
        logger.warn('Could not revoke pending invitations in Clerk', { 
          error: revokeError, 
          email: pendingPlayer.email 
        })
        // Don't fail - this is cleanup
      }
      
      // Player already exists - just update the pending player status
      // and update matches to reference the existing player
      const { error: updatePendingError } = await supabase
        .from('pending_players')
        .update({ status: 'accepted' })
        .eq('id', pendingPlayerId)
      
      if (updatePendingError) {
        logger.error('Error updating pending player status', updatePendingError, { pendingPlayerId })
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to update pending player status',
          data: updatePendingError
        })
      }
      
      // Update matches with this pending player to reference the existing player
      const { error: updateMatchesError } = await supabase
        .from('matches')
        .update({ 
          player2_id: existingPlayer.id,
          pending_player2_id: null
        })
        .eq('pending_player2_id', pendingPlayerId)
      
      if (updateMatchesError) {
        logger.warn('Error updating matches (non-critical)', { error: updateMatchesError, pendingPlayerId })
        // Don't fail if matches update fails - it's not critical
      }
      
      return {
        success: true,
        player_id: existingPlayer.id,
        message: 'Invitation accepted - linked to existing player'
      }
    }
    
    // Create player record from pending player data
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        clerk_id,
        name: pendingPlayer.name,
        category_id: pendingPlayer.category_id,
        elo: 1000
      })
      .select(`
        *,
        category:categories(id, name, description, order)
      `)
      .single()
    
    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player from pending player',
        data: insertError
      })
    }
    
    // Revoke any remaining pending invitations in Clerk for this email
    // This cleans up any duplicate invitations that might exist
    try {
      await revokePendingInvitationsByEmail(pendingPlayer.email)
    } catch (revokeError) {
      logger.warn('Could not revoke pending invitations in Clerk', { 
        error: revokeError, 
        email: pendingPlayer.email 
      })
      // Don't fail - this is cleanup
    }
    
    // Update pending player status
    const { error: updatePendingError } = await supabase
      .from('pending_players')
      .update({ status: 'accepted' })
      .eq('id', pendingPlayerId)
    
    if (updatePendingError) {
      logger.error('Error updating pending player status', updatePendingError, { pendingPlayerId })
      // Don't fail here - player was created successfully
      // Just log the error
    }
    
    // Update all matches with this pending player to reference the new player
    const { error: updateMatchesError } = await supabase
      .from('matches')
      .update({ 
        player2_id: newPlayer.id,
        pending_player2_id: null
      })
      .eq('pending_player2_id', pendingPlayerId)
    
    if (updateMatchesError) {
      logger.warn('Error updating matches (non-critical)', { error: updateMatchesError, pendingPlayerId })
      // Don't fail if matches update fails - it's not critical
    }
    
    return {
      success: true,
      player: newPlayer,
      message: 'Invitation accepted - player created'
    }
  } catch (error: unknown) {
    handleApiError(error, 'PUT /api/pending-players/[id]')
  }
})

