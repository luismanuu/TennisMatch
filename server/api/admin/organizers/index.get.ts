import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getAllClerkInvitations, getClerkClient } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()
    const clerkClient = getClerkClient()

    // Get all players with tournament_organizer role
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, name, clerk_id, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (playersError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: playersError
      })
    }

    // Get Clerk users to check their roles
    const organizers: any[] = []
    
    for (const player of allPlayers || []) {
      try {
        const clerkUser = await clerkClient.users.getUser(player.clerk_id)
        const role = clerkUser.publicMetadata?.role as string | undefined
        
        if (role === 'tournament_organizer') {
          organizers.push({
            id: player.id,
            clerk_id: player.clerk_id,
            name: player.name,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            created_at: player.created_at,
            updated_at: player.updated_at
          })
        }
      } catch (err) {
        // Skip if user doesn't exist in Clerk
        console.warn(`Could not fetch Clerk user for ${player.clerk_id}:`, err)
      }
    }

    // Also get pending invitations for tournament organizers
    const { invitations: clerkInvitations } = await getAllClerkInvitations()
    const pendingInvitations = clerkInvitations
      .filter((inv: any) => {
        const metadata = inv.publicMetadata as any
        return metadata?.role === 'tournament_organizer' && !inv.revoked
      })
      .map((inv: any) => ({
        id: inv.id,
        email: inv.emailAddress,
        name: (inv.publicMetadata as any)?.name || inv.emailAddress?.split('@')[0] || 'Unknown',
        status: inv.status,
        created_at: inv.createdAt
      }))

    return {
      organizers,
      pendingInvitations
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

