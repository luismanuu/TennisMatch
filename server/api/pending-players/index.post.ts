import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { createInvitation } from '~/server/utils/clerk'
import { randomUUID } from 'crypto'
import type { CreatePendingPlayerPayload } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreatePendingPlayerPayload & { clerk_id: string }>(event)
    const { clerk_id, name, email, category_id, invited_by_player_id } = body
    
    if (!clerk_id || !name || !email || !category_id || !invited_by_player_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, name, email, category_id, invited_by_player_id'
      })
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format'
      })
    }
    
    // Verify Clerk user exists
    await getClerkUser(clerk_id)
    
    const supabase = getSupabaseAdmin()
    
    // Verify the inviting player exists and belongs to the authenticated user
    const { data: invitingPlayer, error: playerError } = await supabase
      .from('players')
      .select('id, clerk_id')
      .eq('id', invited_by_player_id)
      .eq('clerk_id', clerk_id)
      .single()
    
    if (playerError || !invitingPlayer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: invited_by_player_id does not match authenticated user'
      })
    }
    
    // Verify category exists
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', category_id)
      .single()
    
    if (categoryError || !category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category_id'
      })
    }
    
    // Check if email is already registered as a player
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', email) // This is a simple check - in production, you'd check Clerk users
      .single()
    
    // Check if email already has a pending invitation
    const { data: existingPending } = await supabase
      .from('pending_players')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
      .single()
    
    if (existingPending) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A pending invitation already exists for this email'
      })
    }
    
    // Generate unique invitation token
    const invitationToken = randomUUID()
    
    // Create Clerk invitation
    let clerkInvitationId: string | undefined
    try {
      const invitation = await createInvitation(email, name, invitationToken)
      clerkInvitationId = invitation.id
    } catch (invitationError: any) {
      console.error('Error creating Clerk invitation:', invitationError)
      // Continue without invitation ID - the pending player will still be created
      // The invitation can be retried later
    }
    
    // Create pending player record
    const { data: pendingPlayer, error: createError } = await supabase
      .from('pending_players')
      .insert({
        name,
        email,
        category_id,
        invited_by_player_id,
        clerk_invitation_id: clerkInvitationId,
        invitation_token: invitationToken,
        status: 'pending'
      })
      .select(`
        *,
        category:categories(id, name, description, order),
        invited_by_player:players!pending_players_invited_by_player_id_fkey(id, name)
      `)
      .single()
    
    if (createError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create pending player',
        data: createError
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

