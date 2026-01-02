import { getSupabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const searchTerm = (query.q as string) || ''
    const excludePlayerId = query.exclude_player_id as string | undefined
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return []
    }
    
    const supabase = getSupabaseAdmin()
    
    // Build query
    let queryBuilder = supabase
      .from('players')
      .select(`
        id,
        name,
        category:categories(id, name, description, order)
      `)
      .ilike('name', `%${searchTerm.trim()}%`)
    
    // Exclude current player if provided
    if (excludePlayerId) {
      queryBuilder = queryBuilder.neq('id', excludePlayerId)
    }
    
    const { data, error } = await queryBuilder
      .limit(20)
      .order('name', { ascending: true })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to search players',
        data: error
      })
    }
    
    return data || []
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

