import { getSupabaseAdmin } from '~/server/utils/supabase'
import { CITY_SELECT_FULL } from '~/server/utils/supabase-selects'
import { InternalServerError, handleApiError } from '~/server/utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('cities')
      .select(CITY_SELECT_FULL)
      .order('order', { ascending: true })

    if (error) {
      throw new InternalServerError('Failed to fetch cities', { error })
    }

    return data
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/cities')
  }
})
