import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ clerk_id: string }>(event)
    const { clerk_id } = body
    
    if (!clerk_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: clerk_id'
      })
    }
    
    // Get Clerk user to get email
    const clerkUser = await getClerkUser(clerk_id)
    const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress
    
    if (!clerkEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Clerk user does not have an email address'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Find pending player by email
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select('*')
      .eq('email', clerkEmail.toLowerCase())
      .eq('status', 'pending')
      .single()
    
    if (fetchError || !pendingPlayer) {
      // No pending invitation found - that's okay, user might be signing up normally
      return {
        success: false,
        message: 'No pending invitation found for this email',
        hasInvitation: false
      }
    }
    
    // Verify invitation is still pending
    if (pendingPlayer.status !== 'pending') {
      return {
        success: false,
        message: `Invitation has already been ${pendingPlayer.status}`,
        hasInvitation: false
      }
    }
    
    // Check if player already exists for this Clerk ID
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_id)
      .single()
    
    if (existingPlayer) {
      // Player already exists - just update the pending player status
      await supabase
        .from('pending_players')
        .update({ status: 'accepted' })
        .eq('id', pendingPlayer.id)
      
      // Update matches with this pending player to reference the existing player
      await supabase
        .from('matches')
        .update({ 
          player2_id: existingPlayer.id,
          pending_player2_id: null
        })
        .eq('pending_player2_id', pendingPlayer.id)
      
      return {
        success: true,
        player_id: existingPlayer.id,
        message: 'Invitation accepted - linked to existing player',
        hasInvitation: true
      }
    }
    
    // Create player record from pending player data
    const { data: newPlayer, error: createError } = await supabase
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
    
    if (createError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player from pending player',
        data: createError
      })
    }
    
    // Update pending player status
    await supabase
      .from('pending_players')
      .update({ status: 'accepted' })
      .eq('id', pendingPlayer.id)
    
    // Update all matches with this pending player to reference the new player
    await supabase
      .from('matches')
      .update({ 
        player2_id: newPlayer.id,
        pending_player2_id: null
      })
      .eq('pending_player2_id', pendingPlayer.id)
    
    return {
      success: true,
      player: newPlayer,
      message: 'Invitation accepted - player created',
      hasInvitation: true
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

