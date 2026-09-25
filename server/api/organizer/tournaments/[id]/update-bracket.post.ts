import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { updateBracketFromCompletedMatches } from '~/server/utils/tournament-brackets'

const BRACKET_TYPES = ['main', 'backdraw', 'all'] as const

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')
    const body = await readBody<{ bracketType?: string }>(event)
    const bracketType = BRACKET_TYPES.find((t) => t === body?.bracketType) ?? 'all'

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // Update bracket from all completed matches
    await updateBracketFromCompletedMatches(tournamentId, bracketType)

    return { success: true, message: 'Bracket updated successfully' }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
