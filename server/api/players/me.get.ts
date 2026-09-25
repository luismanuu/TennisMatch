import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  try {
    const supabase = getSupabaseAdmin()
    
    // Try to fetch existing player profile (only active players)
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select(`
        *,
        category:categories(*),
        city:cities(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching player from Supabase:', {
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      })
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch player profile: ${fetchError.message || 'Unknown error'}`,
        data: {
          error: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code
        }
      })
    }
    
    // If player exists, return it
    if (player) {
      return player
    }
    
    // Profile doesn't exist yet; the client can then create it
    return null
  } catch (error: any) {
    console.error('Unexpected error in players/me endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

