import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
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




