import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireOrganizer, verifyOrganizerOwnsTournament } from '~/server/utils/organizer'
import { recalculateGroupStandings } from '~/server/utils/tournament-brackets'
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
    const results: Array<{ groupId: string; success: boolean; error?: string }> = []
    for (const group of groups || []) {
      try {
        await recalculateGroupStandings(tournamentId, group.id, supabase)
        results.push({ groupId: group.id, success: true })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ groupId: group.id, success: false, error: message })
      }
    }

    return {
      success: true,
      message: 'Standings recalculated successfully',
      results
    }
  } catch (error: unknown) {
    handleApiError(error, 'POST /api/organizer/tournaments/[id]/recalculate-standings')
  }
})


