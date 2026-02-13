import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { organizerTournamentPlayersSearchQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(organizerTournamentPlayersSearchQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))
    const searchTerm = query.q || ''
    const limit = query.limit ?? 20
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return []
    }
    
    await requireOrganizer(clerkId)
    
    const supabase = getSupabaseAdmin()
    
    // Get organizer's player ID
    const { data: organizer, error: organizerError } = await supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()
    
    if (organizerError || !organizer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizer not found'
      })
    }
    
    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId, supabase)
    
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
      .limit(limit)
      .order('name', { ascending: true })
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to search players',
        data: error
      })
    }
    
    return players || []
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/organizer/tournaments/[id]/players.search')
  }
})

