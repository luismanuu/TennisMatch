import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('order', { ascending: true })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch categories',
        data: error
      })
    }
    
    return data
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

