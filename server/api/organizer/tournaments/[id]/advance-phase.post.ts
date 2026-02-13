import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { advanceTournamentPhase } from '~/server/utils/tournament-phases'
import { clerkIdBodySchema, tournamentIdSchema, validateBody, validateQuery } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const { clerk_id: clerkId } = validateBody(clerkIdBodySchema, await readBody(event))
    const tournamentId = validateQuery(tournamentIdSchema, getRouterParam(event, 'id'))

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

    // Advance phase
    const newPhase = await advanceTournamentPhase(tournamentId, supabase)

    return {
      success: true,
      newPhase,
      message: `Tournament advanced to ${newPhase} phase`
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/organizer/tournaments/[id]/advance-phase')
  }
})

