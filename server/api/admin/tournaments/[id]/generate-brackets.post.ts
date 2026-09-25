import { requireAdmin } from '~/server/utils/session'
import { generateGroupStageBrackets } from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const tournamentId = getRouterParam(event, 'id')

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    // Groups, group players, standings, matches and tournament_matches in one transaction.
    // Main and backdraw brackets are generated after the group stage completes.
    const { groups, groupMatches } = await generateGroupStageBrackets(tournamentId, false)

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
