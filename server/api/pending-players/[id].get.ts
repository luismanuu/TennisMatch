import { getSupabaseAdmin } from '~/server/utils/supabase'
import { CATEGORY_SELECT_FULL } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const pendingPlayerId = getRouterParam(event, 'id')
    
    if (!pendingPlayerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pending Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch public pending player profile (no authentication required)
    // Return public information: name, email, category
    // Do NOT return: clerk_invitation_id, invitation_token
    const { data: pendingPlayer, error: fetchError } = await supabase
      .from('pending_players')
      .select(`
        id,
        name,
        email,
        category_id,
        category:categories(${CATEGORY_SELECT_FULL}),
        status,
        created_at
      `)
      .eq('id', pendingPlayerId)
      .single()
    
    if (fetchError || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pending player not found'
      })
    }
    
    return pendingPlayer
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/pending-players/[id]')
  }
})

