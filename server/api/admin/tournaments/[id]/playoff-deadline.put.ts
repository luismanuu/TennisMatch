import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'
import { createPlayoffRoundDeadlines } from '~/server/utils/tournament-scheduling'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const body = await readBody<{
      bracket_type: 'main' | 'backdraw'
      rounds: Array<{
        round_number: number
        round_name: string
        deadline: string
      }>
    }>(event)
    const { bracket_type, rounds } = body
    const tournamentId = getRouterParam(event, 'id')

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

