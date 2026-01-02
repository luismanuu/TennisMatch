import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    
    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation token is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch pending player by invitation token
    const { data: pendingPlayer, error } = await supabase
      .from('pending_players')
      .select(`
        *,
        category:categories(id, name, description, order),
        invited_by_player:players!pending_players_invited_by_player_id_fkey(id, name)
      `)
      .eq('invitation_token', token)
      .single()
    
    if (error || !pendingPlayer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found or invalid'
      })
    }
    
    // Check if invitation is still valid
    if (pendingPlayer.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Invitation has already been ${pendingPlayer.status}`
      })
    }
    
    // Check if invitation is expired (optional: add expiration logic)
    // For now, we'll just check the status
    
    return pendingPlayer
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

