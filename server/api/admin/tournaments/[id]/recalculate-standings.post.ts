import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { recalculateGroupStandings } from '~/server/utils/tournament-brackets'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const clerkId = query.clerk_id as string
    const tournamentId = getRouterParam(event, 'id')

    if (!clerkId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Clerk ID required'
      })
    }

    if (!tournamentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tournament ID is required'
      })
    }

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Verify tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

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


