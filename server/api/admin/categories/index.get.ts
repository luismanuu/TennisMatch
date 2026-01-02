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

    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .order('order', { ascending: true })

    if (fetchError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch categories',
        data: fetchError
      })
    }

    return categories || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

