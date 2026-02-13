import { getSupabaseAdmin } from '~/server/utils/supabase'
import { CATEGORY_SELECT_FULL, PLAYER_SELECT_MIN_WITH_CLERK, TOURNAMENT_SELECT_CORE } from '~/server/utils/supabase-selects'

export default defineEventHandler(async (event) => {
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
        ${TOURNAMENT_SELECT_CORE},
        category:categories(${CATEGORY_SELECT_FULL}),
        created_by_player:players!tournaments_created_by_fkey(${PLAYER_SELECT_MIN_WITH_CLERK}),
        organizer:players!tournaments_organizer_id_fkey(${PLAYER_SELECT_MIN_WITH_CLERK}),
        registrations:tournament_registrations(
          id,
          tournament_id,
          player_id,
          status,
          registered_at,
          withdrawn_at,
          confirmed_at,
          check_in_status,
          check_in_at,
          player:players(
            id,
            name,
            category_id,
            category:categories(${CATEGORY_SELECT_FULL})
          )
        ),
        groups:tournament_groups(
          id,
          tournament_id,
          group_name,
          group_number,
          created_at,
          players:tournament_group_players(
            id,
            tournament_id,
            group_id,
            player_id,
            seed_position,
            player:players(id, name)
          )
        ),
        rounds:tournament_rounds(
          id,
          tournament_id,
          round_number,
          round_name,
          bracket_type,
          deadline,
          status,
          created_at,
          updated_at
        )
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
  } catch (error: unknown) {
    handleApiError(error, 'GET /api/tournaments/[id]')
  }
})

