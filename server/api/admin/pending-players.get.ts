import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    // Get clerk_id from query (passed from client)
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    // Verify admin access
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Fetch all pending players with related data
    const { data: pendingPlayers, error: fetchError } = await supabase
      .from('pending_players')
      .select(`
        id,
        name,
        email,
        category_id,
        category:categories(id, name, description, order),
        invited_by_player_id,
        invited_by_player:players!pending_players_invited_by_player_id_fkey(id, name),
        clerk_invitation_id,
        invitation_token,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch pending players',
        data: fetchError
      })
    }
    
    return pendingPlayers || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

