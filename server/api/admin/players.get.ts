import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getClerkClient } from '~/server/utils/clerk'
import { adminPlayersListQuerySchema, validateQuery } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminPlayersListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()
    const clerkClient = getClerkClient()

    // Check if we should include deleted players
    const includeDeleted = query.include_deleted ?? false
    
    // Pagination parameters
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    // Build count query for total
    let countQuery = supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
    
    if (!includeDeleted) {
      countQuery = countQuery.eq('status', 'active')
    }
    
    const { count, error: countError } = await countQuery
    
    if (countError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to count players',
        data: countError
      })
    }

    let queryBuilder = supabase
      .from('players')
      .select(`
        id,
        clerk_id,
        name,
        phone_number,
        category_id,
        category:categories(id, name, description, order),
        elo,
        total_matches_played,
        placement_matches_completed,
        status,
        deleted_at,
        created_at,
        updated_at
      `)

    // Filter out deleted players by default, unless include_deleted is true
    if (!includeDeleted) {
      queryBuilder = queryBuilder.eq('status', 'active')
    }

    // Apply pagination
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: players, error: fetchError } = await queryBuilder

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: fetchError
      })
    }

    // Enrich players with email and role from Clerk
    const playersWithEmail = await Promise.all(
      (players || []).map(async (player) => {
        try {
          const clerkUser = await clerkClient.users.getUser(player.clerk_id)
          const role = clerkUser.publicMetadata?.role as string | undefined
          return {
            ...player,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            role: role || 'player'
          }
        } catch (err) {
          // Skip if user doesn't exist in Clerk
          logger.warn('Could not fetch Clerk user', { error: err, clerkId: player.clerk_id, playerId: player.id })
          return {
            ...player,
            email: '',
            role: 'player'
          }
        }
      })
    )

    return {
      data: playersWithEmail,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      page_size: limit
    }
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/players')
  }
})

