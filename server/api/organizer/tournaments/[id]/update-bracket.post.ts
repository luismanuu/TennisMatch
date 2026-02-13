import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { updateBracketFromCompletedMatches } from '~/server/utils/tournament-brackets'
import {
  clerkIdQuerySchema,
  tournamentIdSchema,
  updateBracketBodySchema,
  validateBody,
  validateQuery
} from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const { clerk_id: clerkId } = validateQuery(clerkIdQuerySchema, getQuery(event))
    const tournamentId = validateQuery(tournamentIdSchema, getRouterParam(event, 'id'))
    const { bracketType } = validateBody(updateBracketBodySchema, await readBody(event))
    const bracketTypeToUpdate = (bracketType ?? 'all') as 'main' | 'backdraw' | 'all'

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

    // Update bracket from all completed matches
    await updateBracketFromCompletedMatches(tournamentId, bracketTypeToUpdate, supabase)

    return { success: true, message: 'Bracket updated successfully' }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/organizer/tournaments/[id]/update-bracket')
  }
})


