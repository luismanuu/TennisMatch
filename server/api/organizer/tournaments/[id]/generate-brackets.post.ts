import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { generateGroupStageBrackets } from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  const { player: organizer } = await requirePlayer(event, 'organizer')

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // Groups, group players, standings, matches, tournament_matches and the move to group_stage, in one transaction
    const { groups, groupMatches } = await generateGroupStageBrackets(tournamentId, true)

    return {
      success: true,
      message: 'Brackets generated successfully',
      groups,
      groupMatches
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
