import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const query = getQuery(event)
    const tournamentId = getRouterParam(event, 'id')
    const searchTerm = (query.q as string) || ''
    
    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return []
    }
    
    const supabase = getSupabaseAdmin()
    
    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)
    
    // Only return players registered in this tournament
    // First get all registrations for this tournament
    const { data: registrations, error: regError } = await supabase
      .from('tournament_registrations')
      .select(`
        player_id
      `)
      .eq('tournament_id', tournamentId)
    
    if (regError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament registrations',
        data: regError
      })
    }
    
    const playerIds = (registrations || []).map(reg => reg.player_id)
    
    if (playerIds.length === 0) {
      return []
    }
    
    // Now search players by name within the registered players
    const { data: players, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        category:categories(id, name, description, order)
      `)
      .in('id', playerIds)
      .ilike('name', `%${searchTerm.trim()}%`)
      .eq('status', 'active')
      .limit(20)
      .order('name', { ascending: true })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to search players',
        data: error
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

