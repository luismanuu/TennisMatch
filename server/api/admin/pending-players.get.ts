import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminPendingPlayersListQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminPendingPlayersListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    
    // Verify admin access
    await requireAdmin(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    const { count, error: countError } = await supabase
      .from('pending_players')
      .select('id', { count: 'exact', head: true })

    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count pending players',
        data: countError
      })
    }

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
      .range(offset, offset + limit - 1)
    
    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch pending players',
        data: fetchError
      })
    }
    
    return {
      data: pendingPlayers || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/pending-players')
  }
})

