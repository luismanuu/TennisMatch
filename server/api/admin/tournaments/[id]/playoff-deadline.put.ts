import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/admin'
import { createPlayoffRoundDeadlines } from '~/server/utils/tournament-scheduling'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      clerk_id: string
      bracket_type: 'main' | 'backdraw'
      rounds: Array<{
        round_number: number
        round_name: string
        deadline: string
      }>
    }>(event)
    const { clerk_id, bracket_type, rounds } = body
    const tournamentId = getRouterParam(event, 'id')

    if (!clerk_id) {
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

    if (!bracket_type || !['main', 'backdraw'].includes(bracket_type)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'bracket_type must be "main" or "backdraw"'
      })
    }

    if (!rounds || rounds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one round deadline is required'
      })
    }

    await requireAdmin(clerk_id)

    const supabase = getSupabaseAdmin()

    await createPlayoffRoundDeadlines(tournamentId, bracket_type, rounds, supabase)

    return {
      success: true,
      message: `${bracket_type} bracket deadlines set successfully`
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

