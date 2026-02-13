import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { createClerkClient } from '@clerk/clerk-sdk-node'
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

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Fetch pending player to get clerk_invitation_id
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select('id, name, email, clerk_invitation_id, status')
      .eq('id', pendingPlayerId)
      .single()

    if (fetchError || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }

    // Revoke invitation in Clerk if it exists
    if (pendingPlayer.clerk_invitation_id) {
      try {
        const config = useRuntimeConfig()
        const client = createClerkClient({ secretKey: config.clerkSecretKey })
        await client.invitations.revokeInvitation(pendingPlayer.clerk_invitation_id)
        logger.info('Revoked Clerk invitation', { invitationId: pendingPlayer.clerk_invitation_id })
      } catch (clerkError: unknown) {
        const err = typeof clerkError === 'object' && clerkError !== null ? (clerkError as Record<string, unknown>) : null
        logger.warn('Could not revoke Clerk invitation (may not exist)', { 
          error: err && typeof err['message'] === 'string' ? (err['message'] as string) : 'Unknown error', 
          invitationId: pendingPlayer.clerk_invitation_id 
        })
        // Continue with deletion even if Clerk revocation fails
      }
    }

    // Delete the pending player record
    const { error: deleteError } = await supabase
      .from('pending_players')
      .delete()
      .eq('id', pendingPlayerId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete pending player',
        data: deleteError
      })
    }

    return {
      success: true,
      message: `Invitation for "${pendingPlayer.name}" (${pendingPlayer.email}) has been deleted successfully`,
      deletedInvitation: {
        id: pendingPlayer.id,
        name: pendingPlayer.name,
        email: pendingPlayer.email
      }
    }
  } catch (error: unknown) {
    handleApiError(error, 'DELETE /api/admin/pending-players/[id]')
  }
})

