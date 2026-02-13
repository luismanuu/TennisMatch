import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { getUnscheduledMatches } from '~/server/utils/tournament-scheduling'
import { clerkIdQuerySchema, tournamentIdSchema, validateParam, validateQuery } from '~/server/utils/validation'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = validateQuery(clerkIdQuerySchema, getQuery(event))
    const clerkId = query.clerk_id
    const tournamentId = validateParam(tournamentIdSchema, getRouterParam(event, 'id'))

    await requireAdmin(clerkId)

    const supabase = getSupabaseAdmin()

    const matches = await getUnscheduledMatches(tournamentId, supabase)

    return matches
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/admin/tournaments/[id]/unscheduled-matches')
  }
})

