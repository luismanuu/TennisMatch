import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { revokePendingInvitationsByEmail, getClerkClient, createInvitation } from '~/server/utils/clerk'
import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      name: string
      email: string
    }>(event)
    
    const { clerk_id, name, email } = body
    
    if (!clerk_id || !name || !email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clerk_id, name, email'
      })
    }
    
    // Verify admin access
    await requireAdmin(clerk_id)
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Check if email is already registered as a player
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, name')
      .eq('clerk_id', email)
      .single()
    
    if (existingPlayer) {
      throw createError({
        statusCode: 409,
        statusMessage: `Email ${email} is already registered as a player (${existingPlayer.name})`
      })
    }
    
    // Check if user already exists in Clerk (this will be checked in createInvitation)
    // We no longer store invitations in DB, only in Clerk
    
    // Generate unique invitation token
    const invitationToken = randomUUID()
    
    // Create Clerk invitation using the existing utility function
    try {
      console.log('Admin creating Clerk invitation for:', { email, name, invitationToken })

      // Use the existing createInvitation function which has proper error handling
      const invitation = await createInvitation(email, name, invitationToken)

      console.log('Clerk invitation created successfully:', { id: invitation.id, email: invitation.emailAddress, status: invitation.status })

      // Return success - we no longer store invitations in DB, only in Clerk
      return {
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation.id,
          email: invitation.emailAddress,
          status: invitation.status,
          name: name
        }
      }
    } catch (invitationError: any) {
      // The createInvitation function already handles error logging and formatting
      throw invitationError
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

