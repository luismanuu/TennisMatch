import { getClerkClient, getAllClerkInvitations } from '~/server/utils/clerk'
import { getSupabaseAdmin } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const r = asRecord(obj)
  const v = r ? r[key] : undefined
  return typeof v === 'string' ? v : undefined
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      email: string
      password: string
      name: string
      category_id?: string
      invitation_token: string
    }>(event)
    
    const { email, password, name, category_id, invitation_token } = body
    
    if (!email || !password || !name || !invitation_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }
    
    const clerkClient = getClerkClient()
    const supabase = getSupabaseAdmin()
    
    // Verify invitation
    const { invitations } = await getAllClerkInvitations()
    const typedInvitations = invitations as unknown as Array<{
      id: string
      emailAddress?: string | null
      revoked?: boolean
      publicMetadata?: unknown
    }>
    const clerkInvitation = typedInvitations.find((inv) => getStringProp(inv.publicMetadata, 'invitationToken') === invitation_token)
    
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
    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      const existingUser = existingUsers[0]!
      const existingRole =
        getStringProp((existingUser as unknown as { publicMetadata?: unknown }).publicMetadata, 'role') || 'player'
      
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
      
      // Get role from invitation metadata and update user if needed
      const invitationMetadata = asRecord(clerkInvitation.publicMetadata) ?? {}
      const role = getStringProp(invitationMetadata, 'role') || 'player'
      
      // For organizers, category_id is not required
      if (role === 'tournament_organizer' && !category_id) {
        // Organizers don't need a category
      } else if (!category_id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'category_id is required for players'
        })
      }
      
      // Update user role if it's different
      if (role !== existingRole) {
        try {
          await clerkClient.users.updateUser(existingUser.id, {
            publicMetadata: {
              role,
            },
          })
        } catch (updateError) {
          logger.warn('Could not update user role', { error: updateError, userId: existingUser.id })
        }
      }

      // User exists but no player - create player
      const { data: newPlayer, error: insertError } = await supabase
        .from('players')
        .insert({
          clerk_id: existingUser.id,
          name: name,
          category_id: category_id || null, // Organizers can have null category_id
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
          statusMessage: 'Failed to create player',
          data: insertError,
        })
      }
      
      // Revoke the invitation
      try {
        await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
      } catch (revokeError) {
        logger.warn('Could not revoke invitation', { error: revokeError, email })
      }
      
      return {
        success: true,
        clerk_id: existingUser.id,
        player: newPlayer,
        message: 'Player created for existing user'
      }
    }
    
    // Get role from invitation metadata
    const invitationMetadata = asRecord(clerkInvitation.publicMetadata) ?? {}
    const role = getStringProp(invitationMetadata, 'role') || 'player'
    
    // For organizers, category_id is not required
    if (role === 'tournament_organizer' && !category_id) {
      // Organizers don't need a category
    } else if (!category_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'category_id is required for players'
      })
    }

    // Create user in Clerk with role preserved
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password: password,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || '',
      publicMetadata: {
        role: role
      }
    })
    
    // Create player in our system (organizers are also stored as players)
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        clerk_id: clerkUser.id,
        name: name,
        category_id: category_id || null, // Organizers can have null category_id
        elo: 1000
      })
      .select(`
        *,
        category:categories(id, name, description, order)
      `)
      .single()
    
    if (insertError) {
      // If player creation fails, try to delete the Clerk user
      try {
        await clerkClient.users.deleteUser(clerkUser.id)
      } catch (deleteError) {
        logger.error('Error deleting Clerk user after player creation failure', deleteError, { email })
      }
      
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create player',
        data: insertError,
      })
    }
    
    // Revoke the invitation in Clerk
    try {
      await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
    } catch (revokeError) {
      logger.warn('Could not revoke invitation', { error: revokeError, email })
    }
    
    return {
      success: true,
      clerk_id: clerkUser.id,
      player: newPlayer,
      message: 'User and player created successfully'
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/invitations/create-user')
  }
})

