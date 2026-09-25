import { getSupabaseAdmin } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/session'

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

    const supabase = getSupabaseAdmin()

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        category:categories(*),
        created_by_player:players!tournaments_created_by_fkey(*),
        organizer:players!tournaments_organizer_id_fkey(*),
        registrations:tournament_registrations(
          *,
          player:players(*)
        ),
        groups:tournament_groups(
          *,
          players:tournament_group_players(
            *,
            player:players(*)
          )
        ),
        rounds:tournament_rounds(*)
      `)
      .eq('id', tournamentId)
      .single()

    if (error || !tournament) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    return tournament
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

