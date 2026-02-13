import { getSupabaseAdmin } from '~/server/utils/supabase'
import { getClerkUser } from '~/server/utils/clerk'
import { logger } from '~/server/utils/logger'
import { clerkIdQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'
import { CATEGORY_SELECT_FULL, CITY_SELECT_FULL } from '~/server/utils/supabase-selects'
import { InternalServerError, handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event) => {
  try {
    // Get Clerk user from the request
    // In Nuxt with Clerk, we can access the user via useClerk() on client
    // For server-side, we need to get the clerk_id from the request
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    
    const supabase = getSupabaseAdmin()
    
    // Try to fetch existing player profile (only active players)
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select(`
        *,
        category:categories(${CATEGORY_SELECT_FULL}),
        city:cities(${CITY_SELECT_FULL})
      `)
      .eq('clerk_id', clerkId)
      .eq('status', 'active')
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = not found
      logger.error('Error fetching player from Supabase', fetchError, {
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      })
      throw new InternalServerError(
        `Failed to fetch player profile: ${fetchError.message || 'Unknown error'}`,
        { error: fetchError.message, details: fetchError.details, hint: fetchError.hint, code: fetchError.code }
      )
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
    } catch (clerkError: unknown) {
      logger.error('Error fetching Clerk user', clerkError, {
        status: typeof (clerkError as { status?: unknown })?.status === 'number' ? (clerkError as { status: number }).status : undefined,
        statusCode: typeof (clerkError as { statusCode?: unknown })?.statusCode === 'number' ? (clerkError as { statusCode: number }).statusCode : undefined
      })
      // Don't throw error if Clerk user doesn't exist - just return null
      // The client can handle creating a new profile
      return null
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/me')
  }
})

