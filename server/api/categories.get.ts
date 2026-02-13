import { getSupabaseAdmin } from '~/server/utils/supabase'
import { CATEGORY_SELECT_FULL } from '~/server/utils/supabase-selects'
import { InternalServerError, handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_FULL)
      .order('order', { ascending: true })

    if (error) {
      throw new InternalServerError('Failed to fetch categories', { error })
    }

    return data
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/categories')
  }
})
