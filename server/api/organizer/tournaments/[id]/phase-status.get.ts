import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { getTournamentPhaseStatus } from '~/server/utils/tournament-phases'
import { clerkIdQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))

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

    // Get phase status
    const phaseStatus = await getTournamentPhaseStatus(tournamentId, supabase)

    return phaseStatus
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/organizer/tournaments/[id]/phase-status')
  }
})

