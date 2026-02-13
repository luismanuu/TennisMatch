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
    const typedInvitations = invitations as unknown as Array<{ id: string; revoked?: boolean; publicMetadata?: unknown }>
    const clerkInvitation = typedInvitations.find((inv) => getStringProp(inv.publicMetadata, 'invitationToken') === invitation_token)

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
        logger.warn('Could not revoke invitation', { error: revokeError })
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

    // Get role from invitation metadata and update user if needed
    const invitationMetadata = asRecord((clerkInvitation as unknown as { publicMetadata?: unknown }).publicMetadata) ?? {}
    const role = getStringProp(invitationMetadata, 'role') || 'player'
    const categoryId =
      getStringProp(invitationMetadata, 'category_id') || getStringProp(invitationMetadata, 'categoryId') || null
    
    // Update user role if it's different
    const currentRole = getStringProp((clerkUser as unknown as { publicMetadata?: unknown }).publicMetadata, 'role') || 'player'
    if (role !== currentRole) {
      try {
        await clerkClient.users.updateUser(clerk_user_id, {
          publicMetadata: {
            role,
          },
        })
      } catch (updateError) {
        logger.warn('Could not update user role', { error: updateError, userId: clerkUser.id })
      }
    }

    // Create player profile
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        clerk_id: clerk_user_id,
        name: userName,
        category_id: categoryId,
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
        statusMessage: 'Failed to create player profile',
        data: insertError,
      })
    }

    // Revoke the invitation
    try {
      await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
    } catch (revokeError) {
      logger.warn('Could not revoke invitation', { error: revokeError })
    }

    return {
      success: true,
      player: newPlayer,
      message: 'Invitation completed successfully for OAuth user'
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/invitations/complete-oauth')
  }
})

