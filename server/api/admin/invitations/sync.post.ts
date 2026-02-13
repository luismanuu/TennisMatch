import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getAllClerkInvitations } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'

type PendingPlayerRow = {
  id: string
  email: string
  clerk_invitation_id: string | null
  status: string
  name: string | null
}

type ClerkInvitationRow = {
  id: string
  emailAddress: string | null
  status: string | null
  revoked: boolean
  createdAt?: unknown
  publicMetadata?: unknown
}

type MismatchIssue = 'email_match_id_mismatch' | 'clerk_revoked_db_pending' | 'clerk_pending_db_expired'

type InvitationMismatch = {
  clerkInvitation: ClerkInvitationRow
  dbInvitation: PendingPlayerRow
  issue: MismatchIssue
}

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

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    // Get all invitations from Clerk
    const { invitations: clerkInvitations, total: clerkTotal } = await getAllClerkInvitations()
    const typedClerkInvitations = clerkInvitations as unknown as ClerkInvitationRow[]
    
    logger.info('Sync: Found Clerk invitations', { count: typedClerkInvitations.length, total: clerkTotal })

    // Get all pending players from database (including expired ones for sync)
    const { data: dbPendingPlayers, error: dbError } = await supabase
      .from('pending_players')
      .select('id, email, clerk_invitation_id, status, name')
      .order('created_at', { ascending: false })
    
    const typedDbPendingPlayers = (dbPendingPlayers ?? []) as unknown as PendingPlayerRow[]
    logger.info('Sync: Found pending players in database', { count: typedDbPendingPlayers.length })

    if (dbError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch pending players from database',
        data: dbError
      })
    }

    // Create maps for easier lookup
    const dbInvitationsByClerkId = new Map<string, PendingPlayerRow>()
    const dbInvitationsByEmail = new Map<string, PendingPlayerRow>()

    typedDbPendingPlayers.forEach((pp) => {
      if (pp.clerk_invitation_id) {
        dbInvitationsByClerkId.set(pp.clerk_invitation_id, pp)
      }
      dbInvitationsByEmail.set(pp.email.toLowerCase(), pp)
    })

    // Analyze differences
    const clerkOnlyInvitations: ClerkInvitationRow[] = []
    const dbOnlyInvitations: PendingPlayerRow[] = []
    const mismatchedInvitations: InvitationMismatch[] = []

    // Check Clerk invitations
    for (const clerkInv of typedClerkInvitations) {
      const clerkEmail = clerkInv.emailAddress?.toLowerCase() || ''
      const clerkStatus = clerkInv.revoked ? 'revoked' : clerkInv.status || 'pending'
      
      logger.debug('Checking Clerk invitation', { 
        invitationId: clerkInv.id, 
        email: clerkInv.emailAddress, 
        status: clerkStatus, 
        revoked: clerkInv.revoked 
      })
      
      const dbInv = clerkInv.id ? dbInvitationsByClerkId.get(clerkInv.id) : null
      const dbInvByEmail = clerkEmail ? dbInvitationsByEmail.get(clerkEmail) : null

      if (!dbInv) {
        // Invitation exists in Clerk but not in database (by ID)
        if (dbInvByEmail) {
          // Same email but different invitation ID - might need to update
          logger.debug('Found email match with ID mismatch', { 
            email: clerkEmail, 
            dbId: dbInvByEmail.id, 
            clerkId: clerkInv.id 
          })
          mismatchedInvitations.push({
            clerkInvitation: clerkInv,
            dbInvitation: dbInvByEmail,
            issue: 'email_match_id_mismatch'
          })
        } else {
          // Completely missing from database
          logger.debug('Clerk invitation not found in database', { 
            invitationId: clerkInv.id, 
            email: clerkEmail 
          })
          clerkOnlyInvitations.push(clerkInv)
        }
      } else {
        // Found by ID - check if status matches
        const dbStatus = dbInv.status
        logger.debug('Found DB match for Clerk invitation', { 
          invitationId: clerkInv.id, 
          dbStatus, 
          clerkStatus 
        })

        if (clerkStatus !== dbStatus) {
          if (clerkStatus === 'revoked' && dbStatus === 'pending') {
            // Clerk revoked but DB still pending
            logger.debug('Mismatch: Clerk revoked but DB pending', { email: clerkEmail })
            mismatchedInvitations.push({
              clerkInvitation: clerkInv,
              dbInvitation: dbInv,
              issue: 'clerk_revoked_db_pending'
            })
          } else if (clerkStatus === 'pending' && dbStatus === 'expired') {
            // Clerk has pending invitation but DB is expired - should reactivate
            logger.debug('Mismatch: Clerk pending but DB expired - will reactivate', { email: clerkEmail })
            mismatchedInvitations.push({
              clerkInvitation: clerkInv,
              dbInvitation: dbInv,
              issue: 'clerk_pending_db_expired'
            })
          }
        }
      }
    }

    // Check database invitations
    for (const dbInv of typedDbPendingPlayers) {
      if (dbInv.clerk_invitation_id) {
        const clerkInv = typedClerkInvitations.find((ci) => ci.id === dbInv.clerk_invitation_id)
        if (!clerkInv) {
          // Invitation exists in database but not in Clerk (was deleted/revoked)
          dbOnlyInvitations.push(dbInv)
        } else if (clerkInv.revoked && dbInv.status === 'pending') {
          // Invitation was revoked in Clerk but still pending in DB
          mismatchedInvitations.push({
            clerkInvitation: clerkInv,
            dbInvitation: dbInv,
            issue: 'clerk_revoked_db_pending'
          })
        } else if (!clerkInv.revoked && clerkInv.status === 'pending' && dbInv.status === 'expired') {
          // Invitation is pending in Clerk but expired in DB - should reactivate
          mismatchedInvitations.push({
            clerkInvitation: clerkInv,
            dbInvitation: dbInv,
            issue: 'clerk_pending_db_expired'
          })
        }
      } else {
        // Check by email for invitations without clerk_invitation_id or with expired status
        const dbEmail = dbInv.email.toLowerCase()
        const clerkInvByEmail = typedClerkInvitations.find(
          (ci) => {
            const ciEmail = ci.emailAddress?.toLowerCase() || ''
            const ciStatus = ci.revoked ? 'revoked' : ci.status || 'pending'
            return ciEmail === dbEmail && !ci.revoked && ciStatus === 'pending'
          }
        )
        
        if (clerkInvByEmail) {
          // Found a pending invitation in Clerk for this email
          logger.debug('Found Clerk invitation by email', { 
            email: dbEmail, 
            clerkId: clerkInvByEmail.id, 
            dbStatus: dbInv.status 
          })
          
          if (dbInv.status === 'expired') {
            // DB is expired but Clerk has pending - should reactivate
            logger.debug('Will reactivate expired DB invitation', { email: dbEmail })
            mismatchedInvitations.push({
              clerkInvitation: clerkInvByEmail,
              dbInvitation: dbInv,
              issue: 'clerk_pending_db_expired'
            })
          } else if (dbInv.status === 'pending' && !dbInv.clerk_invitation_id) {
            // DB is pending but missing clerk_invitation_id - update it
            logger.debug('Will update missing clerk_invitation_id', { email: dbEmail })
            mismatchedInvitations.push({
              clerkInvitation: clerkInvByEmail,
              dbInvitation: dbInv,
              issue: 'email_match_id_mismatch'
            })
          }
        } else {
          // No matching Clerk invitation found by email
          if (dbInv.status === 'pending') {
            // Pending invitation without matching Clerk invitation
            logger.debug('DB pending invitation has no matching Clerk invitation', { email: dbEmail })
            dbOnlyInvitations.push(dbInv)
          } else if (dbInv.status === 'expired' && !dbInv.clerk_invitation_id) {
            // Expired invitation without clerk_invitation_id - might have been deleted in Clerk
            logger.debug('DB expired invitation has no matching Clerk invitation', { email: dbEmail })
            // Don't add to dbOnlyInvitations as it's already expired
          }
        }
      }
    }

    // Perform sync actions
    const syncResults = {
      clerkOnly: clerkOnlyInvitations.length,
      dbOnly: dbOnlyInvitations.length,
      mismatched: mismatchedInvitations.length,
      actions: [] as Array<Record<string, unknown>>
    }

    // Update database for mismatched invitations
    for (const mismatch of mismatchedInvitations) {
      if (mismatch.issue === 'clerk_revoked_db_pending') {
        try {
          const { error: updateError } = await supabase
            .from('pending_players')
            .update({ status: 'expired' })
            .eq('id', mismatch.dbInvitation.id)

          if (!updateError) {
            syncResults.actions.push({
              type: 'updated_status',
              invitationId: mismatch.dbInvitation.id,
              email: mismatch.dbInvitation.email,
              from: 'pending',
              to: 'expired',
              reason: 'Clerk invitation was revoked'
            })
          }
        } catch (error) {
          logger.error('Error updating invitation status', error, { invitationId: mismatch.dbInvitation.id })
        }
      } else if (mismatch.issue === 'clerk_pending_db_expired') {
        // Reactivate expired invitation in DB because Clerk has a pending invitation
        try {
          logger.info('Reactivating invitation', { 
            invitationId: mismatch.dbInvitation.id, 
            email: mismatch.dbInvitation.email 
          })
          const updateData: Record<string, unknown> = { 
            status: 'pending',
            updated_at: new Date().toISOString()
          }
          // Update clerk_invitation_id if it's different or missing
          if (mismatch.dbInvitation.clerk_invitation_id !== mismatch.clerkInvitation.id) {
            updateData.clerk_invitation_id = mismatch.clerkInvitation.id
            logger.debug('Updating clerk_invitation_id', { 
              invitationId: mismatch.dbInvitation.id,
              from: mismatch.dbInvitation.clerk_invitation_id || 'null', 
              to: mismatch.clerkInvitation.id 
            })
          }
          
          const { error: updateError, data: updatedData } = await supabase
            .from('pending_players')
            .update(updateData)
            .eq('id', mismatch.dbInvitation.id)
            .select()

          if (!updateError) {
            logger.info('Successfully reactivated invitation', { invitationId: mismatch.dbInvitation.id })
            syncResults.actions.push({
              type: 'reactivated_invitation',
              invitationId: mismatch.dbInvitation.id,
              email: mismatch.dbInvitation.email,
              from: 'expired',
              to: 'pending',
              reason: 'Clerk has pending invitation',
              clerkInvitationId: mismatch.clerkInvitation.id
            })
          } else {
            logger.error('Error reactivating invitation', updateError, { invitationId: mismatch.dbInvitation.id })
          }
        } catch (error) {
          logger.error('Error reactivating invitation', error, { invitationId: mismatch.dbInvitation.id })
        }
      } else if (mismatch.issue === 'email_match_id_mismatch') {
        // Update database invitation with Clerk invitation ID
        try {
          const { error: updateError } = await supabase
            .from('pending_players')
            .update({ clerk_invitation_id: mismatch.clerkInvitation.id })
            .eq('id', mismatch.dbInvitation.id)

          if (!updateError) {
            syncResults.actions.push({
              type: 'updated_clerk_id',
              invitationId: mismatch.dbInvitation.id,
              email: mismatch.dbInvitation.email,
              clerkInvitationId: mismatch.clerkInvitation.id
            })
          }
        } catch (error) {
          logger.error('Error updating clerk_invitation_id', error, { invitationId: mismatch.dbInvitation.id })
        }
      }
    }

    // Update database invitations that no longer exist in Clerk (were deleted)
    for (const dbOnly of dbOnlyInvitations) {
      if (dbOnly.status === 'pending' && dbOnly.clerk_invitation_id) {
        // Invitation was deleted in Clerk but still pending in DB
        try {
          const { error: updateError } = await supabase
            .from('pending_players')
            .update({ status: 'expired', clerk_invitation_id: null })
            .eq('id', dbOnly.id)

          if (!updateError) {
            syncResults.actions.push({
              type: 'updated_status',
              invitationId: dbOnly.id,
              email: dbOnly.email,
              from: 'pending',
              to: 'expired',
              reason: 'Clerk invitation was deleted'
            })
          }
        } catch (error) {
          logger.error('Error updating deleted invitation status', error, { invitationId: dbOnly.id })
        }
      }
    }

    return {
      success: true,
      summary: {
        clerkTotal,
        dbTotal: typedDbPendingPlayers.length,
        clerkOnly: clerkOnlyInvitations.length,
        dbOnly: dbOnlyInvitations.length,
        mismatched: mismatchedInvitations.length,
        synced: syncResults.actions.length
      },
      details: {
        clerkOnlyInvitations: clerkOnlyInvitations.map((inv) => ({
          id: inv.id,
          email: inv.emailAddress,
          status: inv.revoked ? 'revoked' : inv.status,
          createdAt: inv.createdAt,
          publicMetadata: inv.publicMetadata
        })),
        dbOnlyInvitations: dbOnlyInvitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          clerk_invitation_id: inv.clerk_invitation_id,
          status: inv.status,
          name: inv.name
        })),
        mismatchedInvitations: mismatchedInvitations.map((m) => ({
          issue: m.issue,
          clerkInvitation: {
            id: m.clerkInvitation.id,
            email: m.clerkInvitation.emailAddress,
            status: m.clerkInvitation.revoked ? 'revoked' : m.clerkInvitation.status
          },
          dbInvitation: {
            id: m.dbInvitation.id,
            email: m.dbInvitation.email,
            status: m.dbInvitation.status
          }
        }))
      },
      actions: syncResults.actions
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/admin/invitations/sync')
  }
})

