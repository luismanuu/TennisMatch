import { getSupabaseAdmin } from '~/server/utils/supabase'
import { playersSearchQuerySchema, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(playersSearchQuerySchema, getQuery(event))
    const searchTerm = query.q || ''
    const excludePlayerId = query.exclude_player_id
    const limit = query.limit ?? 20
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return []
    }
    
    const supabase = getSupabaseAdmin()
    
    // Build query - only search active players
    let queryBuilder = supabase
      .from('players')
      .select(`
        id,
        name,
        elo,
        total_matches_played,
        placement_matches_completed,
        category:categories(id, name, description, order)
      `)
      .ilike('name', `%${searchTerm.trim()}%`)
      .eq('status', 'active')
    
    // Exclude current player if provided
    if (excludePlayerId) {
      queryBuilder = queryBuilder.neq('id', excludePlayerId)
    }
    
    const { data, error } = await queryBuilder
      .limit(limit)
      .order('name', { ascending: true })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to search players',
        data: error
      })
    }
    
    return data || []
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/players/search')
  }
})

