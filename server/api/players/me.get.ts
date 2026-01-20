import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'

export default defineEventHandler(async (event) => {
  try {
    // Get Clerk user from the request
    // In Nuxt with Clerk, we can access the user via useClerk() on client
    // For server-side, we need to get the clerk_id from the request
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    
    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Try to fetch existing player profile (only active players)
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select(`
        *,
        category:categories(*),
        city:cities(*)
      `)
      .eq('clerk_id', clerkId)
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
    
    // If player doesn't exist, get Clerk user info and return null
    // The client can then create the profile
    try {
      const clerkUser = await getClerkUser(clerkId)
      return null // Profile doesn't exist yet
    } catch (clerkError: any) {
      console.error('Error fetching Clerk user:', {
        message: clerkError?.message,
        status: clerkError?.status,
        statusCode: clerkError?.statusCode
      })
      // Don't throw error if Clerk user doesn't exist - just return null
      // The client can handle creating a new profile
      return null
    }
  } catch (error: any) {
    console.error('Unexpected error in players/me endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
      data: error.data || error
    })
  }
})

