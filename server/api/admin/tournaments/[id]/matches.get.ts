import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { adminTournamentMatchesListQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(adminTournamentMatchesListQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const limit = query.limit ?? 5000
    const offset = query.offset ?? 0
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    // Get all tournament matches
    const { data: tournamentMatches, error: tmError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        match:matches(
          id,
          player1_id,
          player2_id,
          status,
          scheduled_at,
          played_at,
          score,
          winner_id
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('bracket_type', { ascending: true })
      .order('round_number', { ascending: true })
      .order('bracket_position', { ascending: true })
      .range(offset, offset + limit - 1)

    if (tmError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch tournament matches',
        data: tmError
      })
    }

    return tournamentMatches || []
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/tournaments/[id]/matches')
  }
})

