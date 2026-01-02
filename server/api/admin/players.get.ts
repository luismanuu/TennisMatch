import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select(`
        id,
        clerk_id,
        name,
        phone_number,
        category_id,
        category:categories(id, name, description, order),
        elo,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch players',
        data: fetchError
      })
    }

    return players || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

