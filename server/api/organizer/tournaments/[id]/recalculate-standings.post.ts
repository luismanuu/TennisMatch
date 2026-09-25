import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requirePlayer } from '~/server/utils/session'
import { verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { recalculateGroupStandings } from '~/server/utils/tournament-brackets'

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

    const supabase = getSupabaseAdmin()

    // Verify organizer owns this tournament
    await verifyOrganizerOwnsTournament(organizer.id, tournamentId)

    // Get all groups for this tournament
    const { data: groups, error: groupsError } = await supabase
      .from('tournament_groups')
      .select('id')
      .eq('tournament_id', tournamentId)

    if (groupsError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament groups',
        data: groupsError
      })
    }

    // Recalculate standings for each group
    const results = []
    for (const group of groups || []) {
      try {
        await recalculateGroupStandings(tournamentId, group.id, supabase)
        results.push({ groupId: group.id, success: true })
      } catch (error: any) {
        results.push({ groupId: group.id, success: false, error: error.message })
      }
    }

    return {
      success: true,
      message: 'Standings recalculated successfully',
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})


