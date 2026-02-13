import { getSupabaseAdmin } from '~/server/utils/supabase'
import { CATEGORY_SELECT_FULL, CITY_SELECT_FULL } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
  try {
    const playerId = getRouterParam(event, 'id')
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Fetch public player profile (no authentication required)
    // Only return public information: name, category, elo, stats
    // Do NOT return: phone_number, clerk_id, email
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select(`
        id,
        name,
        category_id,
        category:categories(${CATEGORY_SELECT_FULL}),
        city_id,
        city:cities(${CITY_SELECT_FULL}),
        elo,
        total_matches_played,
        win_streak,
        placement_matches_completed,
        created_at
      `)
      .eq('id', playerId)
      .single()
    
    if (fetchError || !player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    return player
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/[id]')
  }
})

