import { getClerkClient, getAllClerkInvitations } from '~/server/utils/clerk'
import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      email: string
      password: string
      name: string
      category_id: string
      invitation_token: string
    }>(event)
    
    const { email, password, name, category_id, invitation_token } = body
    
    if (!email || !password || !name || !category_id || !invitation_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }
    
    const clerkClient = getClerkClient()
    const supabase = getSupabaseAdmin()
    
    // Verify invitation
    const { invitations } = await getAllClerkInvitations()
    const clerkInvitation = invitations.find((inv: any) => {
      const metadata = (inv.publicMetadata as any) || {}
      return metadata.invitationToken === invitation_token
    })
    
    if (!clerkInvitation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found'
      })
    }
    
    if (clerkInvitation.emailAddress?.toLowerCase() !== email.toLowerCase()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Email does not match invitation'
      })
    }
    
    if (clerkInvitation.revoked) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation has been revoked'
      })
    }
    
    // Check if user already exists in Clerk
    const existingUsers = await clerkClient.users.getUserList({ emailAddress: [email] })
    if (existingUsers.data && existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0]
      
      // Check if player already exists
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('clerk_id', existingUser.id)
        .single()
      
      if (existingPlayer) {
        throw createError({
          statusCode: 409,
          statusMessage: 'User already exists and has a player profile'
        })
      }
      
      // User exists but no player - create player
      const { data: newPlayer, error: createError } = await supabase
        .from('players')
        .insert({
          clerk_id: existingUser.id,
          name: name,
          category_id: category_id,
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
          statusMessage: 'Failed to create player',
          data: createError
        })
      }
      
      // Revoke the invitation
      try {
        await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
      } catch (revokeError) {
        console.warn('Could not revoke invitation:', revokeError)
      }
      
      return {
        success: true,
        clerk_id: existingUser.id,
        player: newPlayer,
        message: 'Player created for existing user'
      }
    }
    
    // Create user in Clerk
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password: password,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || ''
    })
    
    // Create player in our system
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({
        clerk_id: clerkUser.id,
        name: name,
        category_id: category_id,
        elo: 1000
      })
      .select(`
        *,
        category:categories(id, name, description, order)
      `)
      .single()
    
    if (createError) {
      // If player creation fails, try to delete the Clerk user
      try {
        await clerkClient.users.deleteUser(clerkUser.id)
      } catch (deleteError) {
        console.error('Error deleting Clerk user after player creation failure:', deleteError)
      }
      
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player',
        data: createError
      })
    }
    
    // Revoke the invitation in Clerk
    try {
      await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
    } catch (revokeError) {
      console.warn('Could not revoke invitation:', revokeError)
    }
    
    return {
      success: true,
      clerk_id: clerkUser.id,
      player: newPlayer,
      message: 'User and player created successfully'
    }
  } catch (error: any) {
    console.error('Error in create user endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})

