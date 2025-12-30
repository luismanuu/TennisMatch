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
    
    // Try to fetch existing player profile
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('clerk_id', clerkId)
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch player profile',
        data: fetchError
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
    } catch (clerkError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Clerk user not found'
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

