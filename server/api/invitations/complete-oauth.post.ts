import { getClerkClient, getAllClerkInvitations } from '~/server/utils/clerk'
import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      invitation_token: string
      clerk_user_id: string
    }>(event)

    const { invitation_token, clerk_user_id } = body

    if (!invitation_token || !clerk_user_id) {
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

    if (clerkInvitation.revoked) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation has been revoked'
      })
    }

    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerk_user_id)
      .single()

    if (existingPlayer) {
      // Player already exists, just revoke the invitation
      try {
        await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
      } catch (revokeError) {
        console.warn('Could not revoke invitation:', revokeError)
      }

      return {
        success: true,
        message: 'Player already exists, invitation revoked'
      }
    }

    // Get user details from Clerk to get name
    const clerkUser = await clerkClient.users.getUser(clerk_user_id)
    const userName = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
      : clerkUser.firstName || clerkUser.lastName || 'Usuario'

    // Create player profile
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({
        clerk_id: clerk_user_id,
        name: userName,
        category_id: clerkInvitation.publicMetadata?.categoryId || null,
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
        statusMessage: 'Failed to create player profile',
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
      player: newPlayer,
      message: 'Invitation completed successfully for OAuth user'
    }
  } catch (error: any) {
    console.error('Error completing OAuth invitation:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})

